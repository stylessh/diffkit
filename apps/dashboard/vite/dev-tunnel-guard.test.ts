import { createServer, type Server } from "node:http";
import { type AddressInfo, connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
	isAllowedOnDevServer,
	refuseTunnelRequests,
	refuseTunnelUpgrades,
} from "./dev-tunnel-guard";

const TUNNEL_HOST = "tunnel.example.test";

function request(method: string, url: string, headers: Record<string, string>) {
	return { method, url, headers };
}

describe("isAllowedOnDevServer", () => {
	it("lets the GitHub webhook through the tunnel", () => {
		expect(
			isAllowedOnDevServer(
				request("POST", "/api/webhooks/github", { host: TUNNEL_HOST }),
			),
		).toBe(true);
		expect(
			isAllowedOnDevServer(
				request("POST", "/api/webhooks/github?source=github", {
					host: `${TUNNEL_HOST}:443`,
				}),
			),
		).toBe(true);
	});

	it.each([
		["GET", "/"],
		["GET", "/cdn-cgi/local/explorer/api/d1/database"],
		["POST", "/cdn-cgi/local/explorer/api/d1/database/local/raw"],
		["POST", "/_serverFn/abc123"],
		["GET", "/__open-in-editor?file=src/router.tsx"],
		["GET", "/__tsd/open-source"],
		["GET", "/@fs/etc/hosts"],
		["GET", "/api/webhooks/github"],
		["POST", "/api/webhooks/github/"],
		["POST", "/api/webhooks/github/../../cdn-cgi/local/explorer/"],
		["POST", "/api/webhooks/%67ithub"],
		["POST", "//api/webhooks/github"],
		["POST", `http://localhost:3000/cdn-cgi/local/?/api/webhooks/github`],
	])("refuses %s %s from the tunnel host", (method, url) => {
		expect(
			isAllowedOnDevServer(request(method, url, { host: TUNNEL_HOST })),
		).toBe(false);
	});

	it.each([
		["localhost:3000"],
		["127.0.0.1:3000"],
		["[::1]:3000"],
		["diffkit.localhost:3000"],
	])("leaves requests to %s alone", (host) => {
		for (const [method, url] of [
			["GET", "/"],
			["GET", "/cdn-cgi/local/explorer/api/d1/database"],
			["POST", "/_serverFn/abc123"],
			["GET", "/__open-in-editor?file=src/router.tsx"],
		]) {
			expect(isAllowedOnDevServer(request(method, url, { host }))).toBe(true);
		}
	});

	it.each([
		[{ host: "localhost:3000", "x-forwarded-host": TUNNEL_HOST }],
		[{ host: "localhost:3000", "x-forwarded-for": "203.0.113.7" }],
		[{ host: "localhost:3000", forwarded: "for=203.0.113.7" }],
		[{ host: "localhost.example.test" }],
		[{ host: "[::1" }],
		[{}],
	])("treats %o as tunnel traffic", (headers) => {
		expect(
			isAllowedOnDevServer(
				request("GET", "/cdn-cgi/local/explorer/api/d1/database", headers),
			),
		).toBe(false);
		expect(
			isAllowedOnDevServer(request("POST", "/api/webhooks/github", headers)),
		).toBe(true);
	});
});

describe("a dev server behind the guard", () => {
	let server: Server | undefined;

	afterEach(() => {
		server?.closeAllConnections();
		server?.close();
		server = undefined;
	});

	async function listen() {
		const reached: string[] = [];
		const listening = createServer((req, res) => {
			refuseTunnelRequests(req, res, () => {
				reached.push(`${req.method} ${req.url}`);
				res.end("reached");
			});
		});
		listening.on("upgrade", (req, socket) => {
			reached.push(`UPGRADE ${req.url}`);
			socket.end("HTTP/1.1 101 Switching Protocols\r\n\r\n");
		});
		refuseTunnelUpgrades(listening);
		server = listening;
		await new Promise<void>((resolve) =>
			listening.listen(0, "127.0.0.1", resolve),
		);
		return { port: (listening.address() as AddressInfo).port, reached };
	}

	function send(port: number, head: string[]) {
		return new Promise<string>((resolve, reject) => {
			let received = "";
			const socket = connect(port, "127.0.0.1", () => {
				socket.write(`${head.join("\r\n")}\r\n\r\n`);
			});
			socket.setEncoding("utf8");
			socket.on("data", (chunk) => {
				received += chunk;
			});
			socket.on("close", () => resolve(received));
			socket.on("error", reject);
		});
	}

	it("answers 404 without running the handler for a tunnel request", async () => {
		const { port, reached } = await listen();

		const response = await send(port, [
			"GET /cdn-cgi/local/explorer/api/d1/database HTTP/1.1",
			`Host: ${TUNNEL_HOST}`,
			"Connection: close",
		]);

		expect(response).toMatch(/^HTTP\/1\.1 404 /u);
		expect(reached).toEqual([]);
	});

	it("drops a WebSocket upgrade from the tunnel before any listener sees it", async () => {
		const { port, reached } = await listen();
		const upgrade = [
			"Connection: Upgrade",
			"Upgrade: websocket",
			"Sec-WebSocket-Version: 13",
			"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
		];

		const fromTunnel = await send(port, [
			"GET /?token=abc HTTP/1.1",
			`Host: ${TUNNEL_HOST}`,
			...upgrade,
		]);
		const fromLocalhost = await send(port, [
			"GET /?token=abc HTTP/1.1",
			`Host: localhost:${port}`,
			...upgrade,
		]);

		expect(fromTunnel).toBe("");
		expect(fromLocalhost).toMatch(/^HTTP\/1\.1 101 /u);
		expect(reached).toEqual(["UPGRADE /?token=abc"]);
	});
});
