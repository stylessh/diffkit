import startEntry from "@tanstack/react-start/server-entry";
import { logRouteError } from "#/lib/route-safety.server";
import {
	applySecurityHeaders,
	unhandledErrorResponse,
} from "#/lib/security-headers.server";

// TanStack Start's type only declares (request, env?) but the runtime
// handler created by the Cloudflare Vite plugin passes (request, env, ctx)
// through to the underlying Worker fetch signature.
type WorkerFetch = (
	request: Request,
	env: Record<string, unknown>,
	ctx: ExecutionContext,
) => Promise<Response>;

async function handleRequest(
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
		return applySecurityHeaders(await handleCommentMediaUpload(request));
	}

	const response = await (startEntry.fetch as unknown as WorkerFetch)(
		request,
		env,
		ctx,
	);

	return applySecurityHeaders(response);
}

export default {
	async fetch(
		request: Request,
		env: Record<string, unknown>,
		ctx: ExecutionContext,
	): Promise<Response> {
		try {
			return await handleRequest(request, env, ctx);
		} catch (error) {
			const { pathname } = new URL(request.url);
			logRouteError("worker", "unhandled request error", error, {
				method: request.method,
				pathname,
			});
			return applySecurityHeaders(unhandledErrorResponse(pathname));
		}
	},
};
