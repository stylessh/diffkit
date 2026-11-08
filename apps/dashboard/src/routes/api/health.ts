import { createFileRoute } from "@tanstack/react-router";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

/**
 * GET /api/health: unauthenticated liveness for the deploy gate and uptime
 * checks. 200 when D1 and KV answer, 503 with per-check details otherwise.
 */
export const Route = createFileRoute("/api/health")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: async () => {
				const [{ env }, health] = await Promise.all([
					import("cloudflare:workers"),
					import("#/lib/health.server"),
				]);
				const { CF_VERSION_METADATA } = env as Cloudflare.Env & {
					CF_VERSION_METADATA?: WorkerVersionMetadata;
				};
				const report = await health.checkHealth({
					db: env.DB,
					kv: env.GITHUB_CACHE_KV,
					versionMetadata: CF_VERSION_METADATA,
				});
				return health.healthResponse(report);
			},
		},
	},
});
