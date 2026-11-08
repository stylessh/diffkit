import { debug } from "./debug";
import {
	type GitHubChangeRow,
	toGitHubChangeRows,
} from "./github-change.server";
import {
	getWebhookChangeEntities,
	getWebhookRepository,
} from "./github-change-entities";
import { getGitHubWebhookPayloadMetadata } from "./github-webhook-debug";
import { describeError } from "./route-safety.server";

/**
 * GitHub App webhook receiver (the logic behind `/api/webhooks/github`).
 *
 * 1. Installation events drop cached installation tokens.
 * 2. Every other event is mapped to change-feed entity keys
 *    (`getWebhookChangeEntities`) and recorded in `github_change` in the
 *    background: never awaited, failures logged, the response is always 202.
 *    Rows expire after 15 minutes (cron sweeper); there is no delivery log.
 *    Redeliveries are not de-duplicated: a duplicate row only makes clients
 *    invalidate the same queries twice within one poll.
 *
 * Status codes: a request GitHub can fix by retrying (missing secret) is a 503;
 * everything wrong with the request itself is a 4xx. Nothing in the payload
 * can cause a 5xx.
 */

/** GitHub caps webhook payloads at 25 MB. */
export const MAX_WEBHOOK_BODY_BYTES = 25 * 1024 * 1024;

const INSTALLATION_TOKEN_INVALIDATION_EVENTS = new Set([
	"installation",
	"installation_repositories",
	"github_app_authorization",
]);

/** GitHub event names are lowercase words joined by underscores. */
const EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/;

export type GitHubWebhookDeps = {
	/** `null` when the webhook secret is not configured. */
	getSecret: () => string | null;
	verifySignature: (input: {
		body: string;
		secret: string;
		signature: string | null;
	}) => Promise<boolean>;
	invalidateInstallationToken: (installationId: number) => Promise<void>;
	/** Inserts change rows; may reject. Called from `runInBackground`. */
	recordChanges: (rows: GitHubChangeRow[]) => Promise<void>;
	/** Registers a promise with `waitUntil`; must not throw on rejection. */
	runInBackground: (task: Promise<unknown>) => void;
	now?: () => number;
};

function text(body: string, status: number) {
	return new Response(body, { status });
}

function isPayloadObject(payload: unknown): payload is Record<string, unknown> {
	return (
		typeof payload === "object" && payload !== null && !Array.isArray(payload)
	);
}

function getWebhookInstallationId(payload: Record<string, unknown>) {
	const installation = payload.installation;
	if (
		isPayloadObject(installation) &&
		typeof installation.id === "number" &&
		Number.isSafeInteger(installation.id)
	) {
		return installation.id;
	}
	return null;
}

/** Records the delivery's entities without delaying the response. */
function recordChangesInBackground(
	event: string,
	payload: Record<string, unknown>,
	deps: GitHubWebhookDeps,
): number {
	const repository = getWebhookRepository(payload);
	const entities = getWebhookChangeEntities(event, payload);
	if (!repository || entities.length === 0) return 0;
	const rows = toGitHubChangeRows(
		entities,
		repository,
		(deps.now ?? Date.now)(),
	);
	deps.runInBackground(
		Promise.resolve()
			.then(() => deps.recordChanges(rows))
			.catch((error: unknown) => {
				console.warn("[github-webhook] failed to record changes", {
					event,
					repo: repository.fullName,
					error: describeError(error),
				});
			}),
	);
	return rows.length;
}

export async function handleGitHubWebhook(
	request: Request,
	deps: GitHubWebhookDeps,
): Promise<Response> {
	const event = request.headers.get("x-github-event");
	const deliveryId = request.headers.get("x-github-delivery");
	const signature = request.headers.get("x-hub-signature-256");
	const webhookSecret = deps.getSecret();

	if (!webhookSecret) {
		debug("github-webhook", "missing webhook secret", { deliveryId, event });
		return text("GitHub webhook secret is not configured.", 503);
	}

	const declaredLength = Number(request.headers.get("content-length"));
	if (
		Number.isFinite(declaredLength) &&
		declaredLength > MAX_WEBHOOK_BODY_BYTES
	) {
		return text("Payload too large.", 413);
	}

	let requestBody: string;
	try {
		requestBody = await request.text();
	} catch {
		return text("Unreadable request body.", 400);
	}

	let isValid = false;
	try {
		isValid = await deps.verifySignature({
			body: requestBody,
			secret: webhookSecret,
			signature,
		});
	} catch (error) {
		console.warn(
			"[github-webhook] signature check failed",
			describeError(error),
		);
	}
	if (!isValid) {
		debug("github-webhook", "rejected webhook due to invalid signature", {
			deliveryId,
			event,
		});
		return text("Invalid webhook signature.", 401);
	}

	if (!event || !EVENT_NAME.test(event)) {
		return text("Missing or invalid GitHub event header.", 400);
	}

	let payload: unknown;
	try {
		payload = JSON.parse(requestBody);
	} catch {
		return text("Invalid JSON payload.", 400);
	}
	if (!isPayloadObject(payload)) {
		return text("Webhook payload must be a JSON object.", 400);
	}

	if (!INSTALLATION_TOKEN_INVALIDATION_EVENTS.has(event)) {
		const recorded = recordChangesInBackground(event, payload, deps);
		return Response.json(
			{ ok: true, event, changes: recorded },
			{ status: 202 },
		);
	}

	const installationId = getWebhookInstallationId(payload);
	let invalidated = false;
	if (installationId !== null) {
		try {
			await deps.invalidateInstallationToken(installationId);
			invalidated = true;
		} catch (error) {
			// The token expires on its own within the hour; do not fail the delivery.
			console.warn("[github-webhook] token invalidation failed", {
				installationId,
				error: describeError(error),
			});
		}
	}

	debug("github-webhook", "processed installation webhook", {
		deliveryId,
		event,
		installationId,
		...getGitHubWebhookPayloadMetadata(payload),
	});

	return Response.json({
		ok: true,
		event,
		invalidatedInstallationToken: invalidated,
	});
}
