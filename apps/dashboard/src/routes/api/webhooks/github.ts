import { env, waitUntil } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { invalidateGitHubInstallationToken } from "#/lib/github.server";
import {
	getGitHubWebhookSecret,
	verifyGitHubWebhookSignature,
} from "#/lib/github-app.server";
import { recordGitHubChanges } from "#/lib/github-change.server";
import { handleGitHubWebhook } from "#/lib/github-webhook.server";
import { guardRoute } from "#/lib/route-safety.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

const handleWebhook = guardRoute(
	"github-webhook",
	(request: Request) =>
		handleGitHubWebhook(request, {
			getSecret: getGitHubWebhookSecret,
			verifySignature: verifyGitHubWebhookSignature,
			invalidateInstallationToken: invalidateGitHubInstallationToken,
			recordChanges: (rows) => recordGitHubChanges(env.DB, rows),
			runInBackground: (task) => {
				try {
					waitUntil(task);
				} catch (error) {
					console.warn("[github-webhook] waitUntil unavailable", error);
				}
			},
		}),
	"webhook_unavailable",
);

export const Route = createFileRoute("/api/webhooks/github")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			POST: ({ request }) => handleWebhook(request),
		},
	},
});
