import startEntry from "@tanstack/react-start/server-entry";

const SECURITY_HEADERS: Record<string, string> = {
	"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

function applySecurityHeaders(response: Response): Response {
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
}

export default {
	async fetch(
		request: Request,
		env: Record<string, unknown>,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		if (
			url.pathname === "/api/comment-media/upload" &&
			request.method === "POST"
		) {
			const { handleCommentMediaUpload } = await import(
				"#/lib/comment-media-upload.handler"
			);
			const uploadResponse = await handleCommentMediaUpload(request);
			return applySecurityHeaders(uploadResponse);
		}

		// TanStack Start's type only declares (request, env?) but the runtime
		// handler created by @cloudflare/vite-plugin passes (request, env, ctx)
		// through to the underlying Worker fetch signature.
		type WorkerFetch = (
			request: Request,
			env: Record<string, unknown>,
			ctx: ExecutionContext,
		) => Promise<Response>;
		const response = await (startEntry.fetch as unknown as WorkerFetch)(
			request,
			env,
			ctx,
		);

		return applySecurityHeaders(response);
	},

	/**
	 * Cron trigger (`triggers.crons`, every 5 minutes): sweeps change-feed
	 * rows older than 15 minutes and checks D1 size. Each task fails on its
	 * own; neither can affect requests. The run is recorded in KV so
	 * `/api/health` can report when maintenance last ran.
	 */
	async scheduled(
		controller: ScheduledController,
		env: { DB: D1Database; GITHUB_CACHE_KV: KVNamespace },
		ctx: ExecutionContext,
	): Promise<void> {
		const [{ runScheduledMaintenance }, { recordMaintenanceRun }] =
			await Promise.all([
				import("#/lib/scheduled-maintenance.server"),
				import("#/lib/health.server"),
			]);
		ctx.waitUntil(
			runScheduledMaintenance(env.DB, controller.scheduledTime).then(
				(summary) => recordMaintenanceRun(env.GITHUB_CACHE_KV, summary),
			),
		);
	},
};
