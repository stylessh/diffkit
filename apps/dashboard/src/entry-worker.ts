import startEntry from "@tanstack/react-start/server-entry";

export { SignalRelay } from "./lib/signal-relay.server";

const SECURITY_HEADERS: Record<string, string> = {
	"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

async function handleWebSocketUpgrade(
	request: Request,
	env: Record<string, unknown>,
): Promise<Response> {
	const { getAuth } = await import("#/lib/auth.server");
	const session = await getAuth().api.getSession({
		headers: request.headers,
	});

	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const signalRelay = env.SIGNAL_RELAY as DurableObjectNamespace | undefined;
	if (!signalRelay) {
		return new Response("Signal relay not configured", { status: 503 });
	}

	const id = signalRelay.idFromName("global");
	const stub = signalRelay.get(id);
	const doUrl = new URL(request.url);
	doUrl.pathname = "/connect";

	return stub.fetch(
		new Request(doUrl.toString(), { headers: request.headers }),
	);
}

export default {
	async fetch(
		request: Request,
		env: Record<string, unknown>,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		if (
			url.pathname === "/api/ws/signals" &&
			request.headers.get("Upgrade") === "websocket"
		) {
			return handleWebSocketUpgrade(request, env);
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

		for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
			response.headers.set(key, value);
		}

		return response;
	},
};
