import { createFileRoute } from "@tanstack/react-router";
import { debug } from "#/lib/debug";
import { invalidateGitHubInstallationToken } from "#/lib/github.server";
import {
	getGitHubWebhookSecret,
	verifyGitHubWebhookSignature,
} from "#/lib/github-app.server";
import {
	markGitHubRevalidationSignals,
	markGitHubWebhookEventFailed,
	markGitHubWebhookEventProcessed,
	recordGitHubWebhookEvent,
} from "#/lib/github-cache";
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

				let recordedNewEvent = false;
				if (deliveryId) {
					recordedNewEvent = await recordGitHubWebhookEvent({
						deliveryId,
						event,
						signalKeys,
					});
				}

				try {
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

					if (deliveryId) {
						await markGitHubWebhookEventProcessed(deliveryId);
					}

					debug("github-webhook", "processed webhook", {
						deliveryId,
						event,
						installationId,
						invalidatedInstallationToken,
						signalKeys,
						updatedSignalCount,
						recordedNewEvent,
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
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);

					if (deliveryId) {
						try {
							await markGitHubWebhookEventFailed(deliveryId, errorMessage);
						} catch (logError) {
							debug("github-webhook", "failed to record processing error", {
								deliveryId,
								logError,
							});
						}
					}

					debug("github-webhook", "processing failed", {
						deliveryId,
						event,
						errorMessage,
					});

					return new Response("Webhook processing failed.", { status: 500 });
				}
			},
		},
	},
});
