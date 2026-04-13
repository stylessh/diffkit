import { createFileRoute } from "@tanstack/react-router";
import { debug } from "#/lib/debug";
import { invalidateGitHubInstallationToken } from "#/lib/github.server";
import {
	getGitHubWebhookSecret,
	verifyGitHubWebhookSignature,
} from "#/lib/github-app.server";
import { markGitHubRevalidationSignals } from "#/lib/github-cache";
import { getGitHubWebhookRevalidationSignalKeys } from "#/lib/github-revalidation";
import { getGitHubWebhookPayloadMetadata } from "#/lib/github-webhook-debug";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";
import { broadcastSignalKeys } from "#/lib/signal-relay-broadcast.server";

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
				debug("github-webhook", "received webhook request", {
					deliveryId,
					event,
					bodyLength: requestBody.length,
					hasSignature: Boolean(signature),
					userAgent: request.headers.get("user-agent"),
				});

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
					debug("github-webhook", "rejected webhook due to missing event", {
						deliveryId,
					});
					return new Response("Missing GitHub event header.", {
						status: 400,
					});
				}

				let payload: unknown;
				try {
					payload = JSON.parse(requestBody) as unknown;
				} catch {
					debug("github-webhook", "rejected webhook due to invalid json", {
						deliveryId,
						event,
						bodyLength: requestBody.length,
					});
					return new Response("Invalid JSON payload.", {
						status: 400,
					});
				}

				debug("github-webhook", "parsed webhook payload", {
					deliveryId,
					event,
					...getGitHubWebhookPayloadMetadata(payload),
				});

				const signalKeys = getGitHubWebhookRevalidationSignalKeys(
					event,
					payload,
				);
				const installationId = getWebhookInstallationId(payload);
				let invalidatedInstallationToken = false;

				if (
					installationId !== null &&
					INSTALLATION_TOKEN_INVALIDATION_EVENTS.has(event)
				) {
					await invalidateGitHubInstallationToken(installationId);
					invalidatedInstallationToken = true;
				}

				const updatedSignalCount =
					await markGitHubRevalidationSignals(signalKeys);

				if (signalKeys.length > 0) {
					await broadcastSignalKeys(signalKeys);
				}

				debug("github-webhook", "processed webhook", {
					deliveryId,
					event,
					installationId,
					invalidatedInstallationToken,
					signalKeys,
					updatedSignalCount,
				});

				return Response.json(
					{
						ok: true,
						event,
						signalCount: signalKeys.length,
						updatedSignalCount,
					},
					{ status: 202 },
				);
			},
		},
	},
});
