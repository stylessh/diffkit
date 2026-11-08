import { createFileRoute } from "@tanstack/react-router";
import { debug } from "#/lib/debug";
import { invalidateGitHubInstallationToken } from "#/lib/github.server";
import {
	getGitHubWebhookSecret,
	verifyGitHubWebhookSignature,
} from "#/lib/github-app.server";
import { getGitHubWebhookPayloadMetadata } from "#/lib/github-webhook-debug";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

/**
 * GitHub App webhook receiver.
 *
 * The only remaining job is dropping cached installation tokens when an
 * installation changes. Webhook-driven cache revalidation (signals, cache
 * namespaces, the delivery log) was removed; see docs/platform-plan.md,
 * "Incidents". Other events are acknowledged and ignored, and nothing is
 * written to D1.
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

				if (!INSTALLATION_TOKEN_INVALIDATION_EVENTS.has(event)) {
					return Response.json({ ok: true, event, ignored: true });
				}

				let payload: unknown;
				try {
					payload = JSON.parse(requestBody) as unknown;
				} catch {
					return new Response("Invalid JSON payload.", {
						status: 400,
					});
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
