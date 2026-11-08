/** File bodies for lumen-labs/beacon, a small TypeScript library. */

export const beaconReadme = `# beacon

Typed realtime events for the browser and the edge.

\`\`\`ts
import { createClient } from "@lumen/beacon";

const client = createClient({ url: "wss://events.example.dev" });
client.on("deploy.finished", (event) => {
	console.log(event.service, event.durationMs);
});
\`\`\`

## Install

\`\`\`sh
pnpm add @lumen/beacon
\`\`\`
`;

export const beaconReadmeWithTransports = `${beaconReadme}
## Transports

| Transport  | Runtime            | Notes                                  |
| ---------- | ------------------ | -------------------------------------- |
| WebSocket  | Browser, Workers   | Default. Full duplex.                  |
| SSE        | Browser, Node 20+  | Receive-only, survives most proxies.   |

Pick one explicitly with \`transport: "sse"\`.

## Reconnects

Beacon reconnects with exponential backoff (250ms → 30s). Events published
while offline are buffered and flushed in order once the socket is back.
`;

export const beaconLicense = `MIT License

Copyright (c) 2026 Lumen Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
`;

export function beaconPackageJson(version: string, extra = "") {
	return `{
	"name": "@lumen/beacon",
	"version": "${version}",
	"description": "Typed realtime events for the browser and the edge",
	"type": "module",
	"exports": {
		".": "./dist/index.js"
	},
	"scripts": {
		"build": "tsup src/index.ts --format esm --dts",
		"test": "vitest run",
		"lint": "biome check ."${extra}
	},
	"devDependencies": {
		"@biomejs/biome": "2.4.5",
		"tsup": "8.5.0",
		"typescript": "5.9.3",
		"vitest": "3.2.4"
	}
}
`;
}

export const beaconTsconfig = `{
	"compilerOptions": {
		"target": "ES2022",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"strict": true,
		"declaration": true,
		"outDir": "dist",
		"lib": ["ES2022", "DOM"]
	},
	"include": ["src"]
}
`;

export const beaconTypes = `export type EventMap = Record<string, unknown>;

export type Listener<T> = (payload: T) => void;

export interface Transport {
	connect(url: string): Promise<void>;
	send(data: string): void;
	close(code?: number): void;
	onMessage(listener: Listener<string>): void;
	onClose(listener: Listener<{ code: number; reason: string }>): void;
}

export interface ClientOptions {
	url: string;
	transport?: "websocket" | "sse";
	headers?: Record<string, string>;
}
`;

export const beaconIndex = `export { createClient } from "./client";
export type { ClientOptions, EventMap, Listener, Transport } from "./types";
`;

export const beaconClientV1 = `import type { ClientOptions, EventMap, Listener, Transport } from "./types";
import { WebSocketTransport } from "./transport/websocket";

export function createClient<Events extends EventMap>(options: ClientOptions) {
	const listeners = new Map<keyof Events, Set<Listener<unknown>>>();
	const transport: Transport = new WebSocketTransport();

	transport.onMessage((raw) => {
		const { type, payload } = JSON.parse(raw) as { type: keyof Events; payload: unknown };
		for (const listener of listeners.get(type) ?? []) {
			listener(payload);
		}
	});

	void transport.connect(options.url);

	return {
		on<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
			const set = listeners.get(type) ?? new Set();
			set.add(listener as Listener<unknown>);
			listeners.set(type, set);
			return () => set.delete(listener as Listener<unknown>);
		},
		emit<K extends keyof Events>(type: K, payload: Events[K]) {
			transport.send(JSON.stringify({ type, payload }));
		},
		close() {
			transport.close(1000);
		},
	};
}
`;

export const beaconClientV2 = `import { nextDelay } from "./backoff";
import { ServerSentEventsTransport } from "./transport/sse";
import { WebSocketTransport } from "./transport/websocket";
import type { ClientOptions, EventMap, Listener, Transport } from "./types";

function createTransport(options: ClientOptions): Transport {
	return options.transport === "sse"
		? new ServerSentEventsTransport(options.headers)
		: new WebSocketTransport();
}

export function createClient<Events extends EventMap>(options: ClientOptions) {
	const listeners = new Map<keyof Events, Set<Listener<unknown>>>();
	const outbox: string[] = [];
	let transport = createTransport(options);
	let attempt = 0;
	let connected = false;

	function dispatch(raw: string) {
		const { type, payload } = JSON.parse(raw) as { type: keyof Events; payload: unknown };
		for (const listener of listeners.get(type) ?? []) {
			listener(payload);
		}
	}

	async function connect() {
		transport.onMessage(dispatch);
		transport.onClose(() => {
			connected = false;
			setTimeout(reconnect, nextDelay(attempt++));
		});
		await transport.connect(options.url);
		connected = true;
		attempt = 0;
		while (outbox.length > 0) {
			transport.send(outbox.shift() as string);
		}
	}

	function reconnect() {
		transport = createTransport(options);
		void connect();
	}

	void connect();

	return {
		on<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
			const set = listeners.get(type) ?? new Set();
			set.add(listener as Listener<unknown>);
			listeners.set(type, set);
			return () => set.delete(listener as Listener<unknown>);
		},
		emit<K extends keyof Events>(type: K, payload: Events[K]) {
			const frame = JSON.stringify({ type, payload });
			if (connected) {
				transport.send(frame);
			} else {
				outbox.push(frame);
			}
		},
		close() {
			transport.close(1000);
		},
	};
}
`;

/** Main after the reconnect-storm fix: reconnects are deduplicated. */
export const beaconClientV3 = beaconClientV2
	.replace(
		"\tlet connected = false;\n",
		"\tlet connected = false;\n\tlet reconnectTimer: ReturnType<typeof setTimeout> | null = null;\n",
	)
	.replace(
		"\t\t\tconnected = false;\n\t\t\tsetTimeout(reconnect, nextDelay(attempt++));\n",
		"\t\t\tconnected = false;\n\t\t\tif (reconnectTimer) return;\n\t\t\treconnectTimer = setTimeout(reconnect, nextDelay(attempt++));\n",
	)
	.replace(
		"\tfunction reconnect() {\n",
		"\tfunction reconnect() {\n\t\treconnectTimer = null;\n",
	);

/** Main later gains an \`onStatus\` hook in the same region the state-machine PR rewrites. */
export const beaconClientV4 = beaconClientV3
	.replace(
		"export function createClient<Events extends EventMap>(options: ClientOptions) {\n",
		'export type ConnectionStatus = "connecting" | "open" | "closed";\n\nexport function createClient<Events extends EventMap>(\n\toptions: ClientOptions & { onStatus?: (status: ConnectionStatus) => void },\n) {\n',
	)
	.replace(
		"\t\tawait transport.connect(options.url);\n\t\tconnected = true;\n",
		'\t\toptions.onStatus?.("connecting");\n\t\tawait transport.connect(options.url);\n\t\tconnected = true;\n\t\toptions.onStatus?.("open");\n',
	);

export const beaconStateMachineClient = `import { nextDelay } from "./backoff";
import { WebSocketTransport } from "./transport/websocket";
import type { ClientOptions, EventMap, Listener, Transport } from "./types";

type State =
	| { kind: "idle" }
	| { kind: "connecting"; attempt: number }
	| { kind: "open"; transport: Transport }
	| { kind: "waiting"; attempt: number; timer: ReturnType<typeof setTimeout> };

export function createClient<Events extends EventMap>(options: ClientOptions) {
	const listeners = new Map<keyof Events, Set<Listener<unknown>>>();
	let state: State = { kind: "idle" };

	function transition(next: State) {
		if (state.kind === "waiting") clearTimeout(state.timer);
		state = next;
	}

	async function open(attempt: number) {
		transition({ kind: "connecting", attempt });
		const transport = new WebSocketTransport();
		transport.onClose(() => {
			const timer = setTimeout(() => open(attempt + 1), nextDelay(attempt));
			transition({ kind: "waiting", attempt: attempt + 1, timer });
		});
		await transport.connect(options.url);
		transition({ kind: "open", transport });
	}

	void open(0);

	return {
		get state() {
			return state.kind;
		},
		on<K extends keyof Events>(type: K, listener: Listener<Events[K]>) {
			const set = listeners.get(type) ?? new Set();
			set.add(listener as Listener<unknown>);
			listeners.set(type, set);
			return () => set.delete(listener as Listener<unknown>);
		},
	};
}
`;

export const beaconBackoff = `const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 30_000;

/** Exponential backoff: 250ms, 500ms, 1s, ... capped at 30s. */
export function nextDelay(attempt: number): number {
	return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
}
`;

export const beaconBackoffJitter = `const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 30_000;

export type JitterMode = "none" | "full" | "equal";

/**
 * Exponential backoff with optional jitter so a fleet of clients that lost
 * the same server does not reconnect in lockstep.
 */
export function nextDelay(
	attempt: number,
	jitter: JitterMode = "full",
	random: () => number = Math.random,
): number {
	const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
	if (jitter === "none") return ceiling;
	if (jitter === "equal") return ceiling / 2 + random() * (ceiling / 2);
	return random() * ceiling;
}
`;

export const beaconBackoffTest = `import { describe, expect, it } from "vitest";
import { nextDelay } from "../backoff";

describe("nextDelay", () => {
	it("doubles until the cap", () => {
		expect(nextDelay(0)).toBe(250);
		expect(nextDelay(1)).toBe(500);
		expect(nextDelay(10)).toBe(30_000);
	});
});
`;

export const beaconBackoffJitterTest = `import { describe, expect, it } from "vitest";
import { nextDelay } from "../backoff";

describe("nextDelay", () => {
	it("doubles until the cap without jitter", () => {
		expect(nextDelay(0, "none")).toBe(250);
		expect(nextDelay(1, "none")).toBe(500);
		expect(nextDelay(10, "none")).toBe(30_000);
	});

	it("keeps full jitter inside the ceiling", () => {
		expect(nextDelay(3, "full", () => 0.5)).toBe(1000);
	});

	it("keeps equal jitter in the upper half", () => {
		expect(nextDelay(3, "equal", () => 0)).toBe(1000);
		expect(nextDelay(3, "equal", () => 1)).toBe(2000);
	});
});
`;

export const beaconWebSocket = `import type { Listener, Transport } from "../types.ts";

export class WebSocketTransport implements Transport {
	#socket: WebSocket | null = null;
	#messageListeners = new Set<Listener<string>>();
	#closeListeners = new Set<Listener<{ code: number; reason: string }>>();

	connect(url: string) {
		return new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(url);
			socket.addEventListener("open", () => resolve(), { once: true });
			socket.addEventListener("error", () => reject(new Error("socket error")), { once: true });
			socket.addEventListener("message", (event) => {
				for (const listener of this.#messageListeners) listener(String(event.data));
			});
			socket.addEventListener("close", (event) => {
				for (const listener of this.#closeListeners) {
					listener({ code: event.code, reason: event.reason });
				}
			});
			this.#socket = socket;
		});
	}

	send(data: string) {
		this.#socket?.send(data);
	}

	close(code = 1000) {
		this.#socket?.close(code);
	}

	onMessage(listener: Listener<string>) {
		this.#messageListeners.add(listener);
	}

	onClose(listener: Listener<{ code: number; reason: string }>) {
		this.#closeListeners.add(listener);
	}
}
`;

export const beaconSse = `import type { Listener, Transport } from "../types.ts";

/** Receive-only transport over Server-Sent Events. */
export class ServerSentEventsTransport implements Transport {
	#source: EventSource | null = null;
	#messageListeners = new Set<Listener<string>>();
	#closeListeners = new Set<Listener<{ code: number; reason: string }>>();

	constructor(readonly headers: Record<string, string> = {}) {}

	connect(url: string) {
		return new Promise<void>((resolve) => {
			const source = new EventSource(url, { withCredentials: true });
			source.addEventListener("open", () => resolve(), { once: true });
			source.addEventListener("message", (event) => {
				for (const listener of this.#messageListeners) listener(event.data);
			});
			source.addEventListener("error", () => {
				for (const listener of this.#closeListeners) {
					listener({ code: 1006, reason: "event stream error" });
				}
			});
			this.#source = source;
		});
	}

	send() {
		throw new Error("SSE transport is receive-only");
	}

	close() {
		this.#source?.close();
	}

	onMessage(listener: Listener<string>) {
		this.#messageListeners.add(listener);
	}

	onClose(listener: Listener<{ code: number; reason: string }>) {
		this.#closeListeners.add(listener);
	}
}
`;

/** SSE over fetch so custom headers work (EventSource cannot set them). */
export const beaconSseHeaders = `import type { Listener, Transport } from "../types.ts";

/**
 * Receive-only transport over Server-Sent Events.
 *
 * Uses \`fetch\` + a stream reader instead of \`EventSource\` so callers can
 * pass auth headers.
 */
export class ServerSentEventsTransport implements Transport {
	#controller: AbortController | null = null;
	#messageListeners = new Set<Listener<string>>();
	#closeListeners = new Set<Listener<{ code: number; reason: string }>>();

	constructor(readonly headers: Record<string, string> = {}) {}

	async connect(url: string) {
		this.#controller = new AbortController();
		const response = await fetch(url, {
			headers: { accept: "text/event-stream", ...this.headers },
			signal: this.#controller.signal,
		});
		if (!response.ok || !response.body) {
			throw new Error(\`SSE connect failed: \${response.status}\`);
		}
		void this.#pump(response.body.getReader());
	}

	async #pump(reader: ReadableStreamDefaultReader<Uint8Array>) {
		const decoder = new TextDecoder();
		let buffer = "";
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let boundary = buffer.indexOf("\\n\\n");
			while (boundary !== -1) {
				const frame = buffer.slice(0, boundary);
				buffer = buffer.slice(boundary + 2);
				const data = frame
					.split("\\n")
					.filter((line) => line.startsWith("data:"))
					.map((line) => line.slice(5).trimStart())
					.join("\\n");
				for (const listener of this.#messageListeners) listener(data);
				boundary = buffer.indexOf("\\n\\n");
			}
		}
		for (const listener of this.#closeListeners) {
			listener({ code: 1000, reason: "stream ended" });
		}
	}

	send() {
		throw new Error("SSE transport is receive-only");
	}

	close() {
		this.#controller?.abort();
	}

	onMessage(listener: Listener<string>) {
		this.#messageListeners.add(listener);
	}

	onClose(listener: Listener<{ code: number; reason: string }>) {
		this.#closeListeners.add(listener);
	}
}
`;

export const beaconCi = `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
`;

export const beaconCiNode20 = beaconCi.replace(
	"node: [18, 20, 22]",
	"node: [20, 22]",
);

export const beaconRelease = `name: Release

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm publish --provenance --no-git-checks
`;

export const beaconPrTemplate = `## What

<!-- One or two sentences. Link the issue: Fixes #123 -->

## Why

## How to test

- [ ] \`pnpm test\`
- [ ] Tried it in the playground
`;

export const beaconChangelog120 = `# Changelog

## 1.2.0

- SSE transport (\`transport: "sse"\`).
- Exponential backoff on reconnect.

## 1.1.0

- WebSocket transport.

## 1.0.0

- First release.
`;

export const beaconChangelog130 = beaconChangelog120.replace(
	"# Changelog\n",
	`# Changelog

## 1.3.0

- Buffer events emitted while offline and flush them in order.
- Fix a reconnect storm after a laptop wakes from sleep.
`,
);

export const beaconTransportInterface = `import type { Listener } from "../types.ts";

export type CloseEvent = { code: number; reason: string };

/** Contract every transport implements. */
export interface Transport {
	readonly kind: string;
	connect(url: string): Promise<void>;
	send(data: string): void;
	close(code?: number): void;
	onMessage(listener: Listener<string>): void;
	onClose(listener: Listener<CloseEvent>): void;
}
`;

export const beaconRegistry = `import type { Transport } from "./transport";
import { WebSocketTransport } from "./websocket";

type TransportFactory = (headers?: Record<string, string>) => Transport;

const registry = new Map<string, TransportFactory>([
	["websocket", () => new WebSocketTransport()],
]);

export function registerTransport(kind: string, factory: TransportFactory) {
	registry.set(kind, factory);
}

export function createTransport(kind: string, headers?: Record<string, string>) {
	const factory = registry.get(kind);
	if (!factory) throw new Error(\`Unknown transport: \${kind}\`);
	return factory(headers);
}
`;

export const beaconWebTransport = `import type { Listener } from "../types.ts";
import type { CloseEvent, Transport } from "./transport";

/**
 * Experimental WebTransport (HTTP/3) transport. Chrome-only for now.
 */
export class WebTransportTransport implements Transport {
	readonly kind = "webtransport";
	#session: WebTransport | null = null;
	#writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
	#messageListeners = new Set<Listener<string>>();
	#closeListeners = new Set<Listener<CloseEvent>>();

	async connect(url: string) {
		const session = new WebTransport(url);
		await session.ready;
		const stream = await session.createBidirectionalStream();
		this.#writer = stream.writable.getWriter();
		this.#session = session;
		void session.closed.then(({ closeCode, reason }) => {
			for (const listener of this.#closeListeners) {
				listener({ code: closeCode ?? 1000, reason });
			}
		});
	}

	send(data: string) {
		void this.#writer?.write(new TextEncoder().encode(data));
	}

	close(code = 1000) {
		this.#session?.close({ closeCode: code });
	}

	onMessage(listener: Listener<string>) {
		this.#messageListeners.add(listener);
	}

	onClose(listener: Listener<CloseEvent>) {
		this.#closeListeners.add(listener);
	}
}
`;
