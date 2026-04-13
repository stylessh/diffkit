import "@tanstack/react-start/server-only";
import { DurableObject } from "cloudflare:workers";

type SubscribeMessage = {
	type: "subscribe";
	keys: string[];
};

function isSubscribeMessage(data: unknown): data is SubscribeMessage {
	return (
		typeof data === "object" &&
		data !== null &&
		"type" in data &&
		data.type === "subscribe" &&
		"keys" in data &&
		Array.isArray(data.keys) &&
		data.keys.every((k: unknown) => typeof k === "string")
	);
}

export class SignalRelay extends DurableObject {
	private subscriptions = new Map<WebSocket, Set<string>>();

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/broadcast" && request.method === "POST") {
			return this.handleBroadcast(request);
		}

		if (url.pathname === "/connect") {
			return this.handleConnect(request);
		}

		return new Response("Not found", { status: 404 });
	}

	private handleConnect(request: Request): Response {
		const upgradeHeader = request.headers.get("Upgrade");
		if (upgradeHeader !== "websocket") {
			return new Response("Expected WebSocket upgrade", { status: 426 });
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		server.accept();
		this.subscriptions.set(server, new Set());

		server.addEventListener("message", (event) => {
			if (typeof event.data !== "string") return;

			try {
				const message: unknown = JSON.parse(event.data);
				if (isSubscribeMessage(message)) {
					this.subscriptions.set(server, new Set(message.keys));
				}
			} catch {
				// ignore malformed messages
			}
		});

		server.addEventListener("close", () => {
			this.subscriptions.delete(server);
		});

		server.addEventListener("error", () => {
			this.subscriptions.delete(server);
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		} as ResponseInit);
	}

	private async handleBroadcast(request: Request): Promise<Response> {
		const body = (await request.json()) as { signalKeys?: string[] };
		const signalKeys = body.signalKeys;
		if (!Array.isArray(signalKeys) || signalKeys.length === 0) {
			return new Response("Missing signalKeys", { status: 400 });
		}

		const signalSet = new Set(signalKeys);
		const payload = JSON.stringify({ type: "signals", keys: signalKeys });
		let notified = 0;

		for (const [ws, subscribedKeys] of this.subscriptions) {
			const hasMatch = [...subscribedKeys].some((key) => signalSet.has(key));
			if (!hasMatch) continue;

			try {
				ws.send(payload);
				notified++;
			} catch {
				this.subscriptions.delete(ws);
			}
		}

		return Response.json({ ok: true, notified });
	}
}
