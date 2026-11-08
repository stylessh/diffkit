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

export const MAX_WEBHOOK_BODY_BYTES = 25 * 1024 * 1024;

const INSTALLATION_TOKEN_INVALIDATION_EVENTS = new Set([
	"installation",
	"installation_repositories",
	"github_app_authorization",
]);

const EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/;

export type GitHubWebhookDeps = {
	getSecret: () => string | null;
	verifySignature: (input: {
		body: string;
		secret: string;
		signature: string | null;
	}) => Promise<boolean>;
	invalidateInstallationToken: (installationId: number) => Promise<void>;
	recordChanges: (rows: GitHubChangeRow[]) => Promise<void>;
	runInBackground: (task: Promise<unknown>) => void;
	now?: () => number;
};

type BodyRead = { kind: "ok"; text: string } | { kind: "too-large" };

async function readBodyWithinLimit(
	request: Request,
	limit: number,
): Promise<BodyRead> {
	const reader = request.body?.getReader();
	if (!reader) return { kind: "ok", text: "" };

	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel();
			return { kind: "too-large" };
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { kind: "ok", text: new TextDecoder().decode(bytes) };
}

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

function recordChangesInBackground(
	event: string,
	payload: Record<string, unknown>,
	deps: GitHubWebhookDeps,
): number {
	const repository = getWebhookRepository(payload);
	const entities = getWebhookChangeEntities(event, payload);
	if (!repository || entities.length === 0) return 0;
	// Redeliveries are not de-duplicated: a duplicate row only makes clients
	// invalidate the same queries twice within one poll.
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

	// 503, not 4xx: the sender did nothing wrong.
	if (!webhookSecret) {
		debug("github-webhook", "missing webhook secret", { deliveryId, event });
		return text("GitHub webhook secret is not configured.", 503);
	}

	let body: BodyRead;
	try {
		body = await readBodyWithinLimit(request, MAX_WEBHOOK_BODY_BYTES);
	} catch {
		return text("Unreadable request body.", 400);
	}
	if (body.kind === "too-large") {
		return text("Payload too large.", 413);
	}
	const requestBody = body.text;

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
			// The token expires within the hour anyway.
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
