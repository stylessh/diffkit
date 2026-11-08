import { env, waitUntil } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { debug } from "#/lib/debug";
import { invalidateGitHubInstallationToken } from "#/lib/github.server";
import {
	getGitHubWebhookSecret,
	verifyGitHubWebhookSignature,
} from "#/lib/github-app.server";
import {
	recordGitHubChanges,
	toGitHubChangeRows,
} from "#/lib/github-change.server";
import {
	getWebhookChangeEntities,
	getWebhookRepository,
} from "#/lib/github-change-entities";
import { getGitHubWebhookPayloadMetadata } from "#/lib/github-webhook-debug";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

/**
 * GitHub App webhook receiver.
 *
 * 1. Installation events drop cached installation tokens.
 * 2. Every other event is mapped to change-feed entity keys
 *    (`getWebhookChangeEntities`) and recorded in `github_change` from
 *    `waitUntil`: never awaited, failures logged, the response is always 202.
 *    Rows expire after 15 minutes (cron sweeper); there is no delivery log.
 *    Redeliveries are not de-duplicated: a duplicate row only makes clients
 *    invalidate the same queries twice within one poll.
 */
const INSTALLATION_TOKEN_INVALIDATION_EVENTS = new Set([
	"installation",
	"installation_repositories",
	"github_app_authorization",
]);

function getWebhookInstallationId(payload: unknown) {
	if (!payload || typeof payload !== "object" || !("installation" in payload)) {
		return null;
	}

	const installation = payload.installation;
	if (
		!installation ||
		typeof installation !== "object" ||
		!("id" in installation) ||
		typeof installation.id !== "number"
	) {
		return null;
	}

	return installation.id;
}

/** Records the delivery's entities without delaying the response. */
function recordChangesInBackground(event: string, payload: unknown): number {
	const repository = getWebhookRepository(payload);
	const entities = getWebhookChangeEntities(event, payload);
	if (!repository || entities.length === 0) return 0;
	const rows = toGitHubChangeRows(entities, repository, Date.now());
	try {
		waitUntil(
			recordGitHubChanges(env.DB, rows).catch((error: unknown) => {
				console.warn("[github-webhook] failed to record changes", {
					event,
					repo: repository.fullName,
					error: error instanceof Error ? error.message : String(error),
				});
			}),
		);
	} catch (error) {
		console.warn("[github-webhook] waitUntil unavailable", error);
	}
	return rows.length;
}

export const Route = createFileRoute("/api/webhooks/github")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			POST: async ({ request }) => {
				const event = request.headers.get("x-github-event");
				const deliveryId = request.headers.get("x-github-delivery");
				const signature = request.headers.get("x-hub-signature-256");
				const webhookSecret = getGitHubWebhookSecret();

				if (!webhookSecret) {
					debug("github-webhook", "missing webhook secret", {
						deliveryId,
						event,
					});
					return new Response("GitHub webhook secret is not configured.", {
						status: 503,
					});
				}

				const requestBody = await request.text();
				const isValid = await verifyGitHubWebhookSignature({
					body: requestBody,
					secret: webhookSecret,
					signature,
				});

				if (!isValid) {
					debug("github-webhook", "rejected webhook due to invalid signature", {
						deliveryId,
						event,
					});
					return new Response("Invalid webhook signature.", {
						status: 401,
					});
				}

				if (!event) {
					return new Response("Missing GitHub event header.", {
						status: 400,
					});
				}

				let payload: unknown;
				try {
					payload = JSON.parse(requestBody) as unknown;
				} catch {
					return new Response("Invalid JSON payload.", {
						status: 400,
					});
				}

				if (!INSTALLATION_TOKEN_INVALIDATION_EVENTS.has(event)) {
					const recorded = recordChangesInBackground(event, payload);
					return Response.json(
						{ ok: true, event, changes: recorded },
						{ status: 202 },
					);
				}

				const installationId = getWebhookInstallationId(payload);
				if (installationId !== null) {
					await invalidateGitHubInstallationToken(installationId);
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
					invalidatedInstallationToken: installationId !== null,
				});
			},
		},
	},
});
