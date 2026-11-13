import type { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";
import type { Duplex } from "node:stream";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

const WEBHOOK_PATH = "/api/webhooks/github";

const PROXY_HEADERS = ["forwarded", "x-forwarded-for", "x-forwarded-host"];

const REFUSAL = `Only POST ${WEBHOOK_PATH} is served through the dev tunnel.\n`;

type GuardedRequest = Pick<IncomingMessage, "method" | "url" | "headers">;

function isLocalHostHeader(hostHeader: string | undefined) {
	if (!hostHeader) {
		return false;
	}
	const host = hostHeader.trim();
	if (host.startsWith("[")) {
		const end = host.indexOf("]");
		return end > 0 && isIP(host.slice(1, end)) === 6;
	}
	const hostname = host.split(":", 1)[0];
	return (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		isIP(hostname) === 4
	);
}

// A request is local only when it names this machine and no proxy relayed it.
// Everything else is treated as tunnel traffic, including a tunnel set up to
// rewrite the Host header, because tunnels add forwarding headers that the
// caller cannot remove.
export function arrivedThroughTunnel(request: GuardedRequest) {
	return (
		!isLocalHostHeader(request.headers.host) ||
		PROXY_HEADERS.some((name) => request.headers[name] !== undefined)
	);
}

export function isAllowedOnDevServer(request: GuardedRequest) {
	if (!arrivedThroughTunnel(request)) {
		return true;
	}
	return (
		request.method === "POST" && request.url?.split("?", 1)[0] === WEBHOOK_PATH
	);
}

export function refuseTunnelRequests(
	request: IncomingMessage,
	response: ServerResponse,
	next: () => void,
) {
	if (isAllowedOnDevServer(request)) {
		next();
		return;
	}
	response.writeHead(404, { "Content-Type": "text/plain" });
	response.end(REFUSAL);
}

// Upgrades skip the middleware stack, and every "upgrade" listener runs no
// matter what an earlier one did, so the only place to stop one before Vite
// and the Workers runtime see it is the event itself.
export function refuseTunnelUpgrades(httpServer: EventEmitter) {
	const emit = httpServer.emit;
	httpServer.emit = function (event: string | symbol, ...args: unknown[]) {
		if (event === "upgrade") {
			const [request, socket] = args as [IncomingMessage, Duplex];
			if (arrivedThroughTunnel(request)) {
				socket.destroy();
				return true;
			}
		}
		return emit.call(this, event, ...args);
	};
}

function guard(server: ViteDevServer | PreviewServer) {
	server.middlewares.use(refuseTunnelRequests);
	if (server.httpServer) {
		refuseTunnelUpgrades(server.httpServer);
	}
}

/**
 * With a webhook tunnel in front of the dev server, limits what arrives
 * through it to the GitHub webhook. Vite's `allowedHosts` admits a host for
 * every path, and the dev server also serves local storage, source files and
 * editor endpoints that have no sign-in of their own.
 */
export function devTunnelGuard(): Plugin {
	return {
		name: "dev-tunnel-guard",
		enforce: "pre",
		configureServer: { order: "pre", handler: guard },
		configurePreviewServer: { order: "pre", handler: guard },
	};
}
