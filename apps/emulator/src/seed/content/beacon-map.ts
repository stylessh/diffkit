/**
 * The demo repository's `.diffkit` folder, so demo mode shows a product map
 * computed from the seeded files, pull requests and issues.
 */
const index = {
	version: 1,
	pitch: "beacon is a typed event client for the browser.",
	description:
		"One createClient call, a transport you can swap, and reconnects that back off instead of hammering the server.",
	bands: [
		{
			id: "library",
			name: "What you import",
			caption: "The public surface of the package.",
			groups: [
				{
					id: "api",
					name: "The client",
					areas: ["client"],
				},
				{
					id: "wire",
					name: "On the wire",
					areas: ["transports", "reconnect"],
				},
			],
		},
		{
			id: "project",
			name: "Around the code",
			caption: "What keeps the package shippable.",
			groups: [
				{
					id: "shipping",
					name: "Shipping",
					areas: ["release"],
				},
			],
		},
	],
	ignore: ["LICENSE", ".diffkit/**", "**/*.sbom.json"],
	outside: [
		{
			id: "server",
			name: "Event server",
			owner: "Your backend",
			role: "The other end of every transport",
		},
		{
			id: "npm",
			name: "Registry",
			owner: "npm",
			role: "Published versions",
		},
	],
	tour: [
		{
			title: "One call",
			text: "An app calls createClient with its event types and gets typed emit and subscribe.",
			areas: ["client"],
			outside: [],
		},
		{
			title: "Pick how events travel",
			text: "A transport carries the frames. WebSocket is the default; others register themselves.",
			areas: ["transports"],
			outside: ["server"],
		},
		{
			title: "Stay connected politely",
			text: "After a drop the client retries, waiting longer each time.",
			areas: ["reconnect", "client"],
			outside: [],
		},
	],
};

// Issue numbers in `issues` follow the seed's timeline; see `issues` in beacon.ts.
const areas: Record<string, object> = {
	client: {
		name: "Event client",
		icon: "code",
		tagline: "createClient, typed emit and subscribe",
		summary:
			"What an app imports. createClient returns an object that sends typed events and calls your listeners when one arrives, whatever transport is underneath.",
		paths: ["src/**"],
		flow: [
			{
				kind: "client",
				label: "createClient",
				note: "Takes the options, picks a transport and returns the client object.",
				path: "src/client.ts",
			},
			{
				kind: "client",
				label: "EventMap types",
				note: "Your event names and payloads, so emit and on are checked at compile time.",
				path: "src/types.ts",
			},
			{
				kind: "client",
				label: "The chosen transport",
				note: "Hands each frame to the transport set in the options.",
			},
			{
				kind: "external",
				label: "Your event server",
				note: "The other end of the connection. beacon only assumes it speaks the chosen transport.",
			},
		],
		features: [
			{
				name: "Typed events",
				summary:
					"An EventMap type names every event and its payload; listeners get the right payload type.",
				path: "src/types.ts",
			},
			{
				name: "Connection status",
				summary:
					"The client reports connecting, open or closed so a UI can show it.",
				path: "src/client.ts",
			},
			{
				name: "Package entry",
				summary: "The one module the package exports from.",
				path: "src/index.ts",
			},
		],
		dependsOn: ["transports", "reconnect"],
		outside: ["server"],
		issues: [
			{
				number: 13,
				note: "A leak in close() would outlive the state-machine rewrite.",
			},
		],
	},
	transports: {
		name: "Transports",
		icon: "refresh",
		tagline: "WebSocket and server-sent events",
		summary:
			"How events travel. Each transport implements one small interface, so the client does not care which one it was given.",
		paths: ["src/transport/**"],
		flow: [
			{
				kind: "client",
				label: "Transport interface",
				note: "connect, send, onMessage and onClose: the whole contract.",
				path: "src/types.ts",
			},
			{
				kind: "client",
				label: "WebSocketTransport",
				note: "The default: one socket, JSON frames.",
				path: "src/transport/websocket.ts",
			},
			{
				kind: "external",
				label: "Your event server",
				note: "Receives the frames the transport sends.",
			},
		],
		features: [
			{
				name: "WebSocket",
				summary: "The default transport, two-way over one socket.",
				path: "src/transport/websocket.ts",
			},
			{
				name: "Server-sent events",
				summary: "Receive-only streaming over plain HTTP.",
				path: "src/transport/sse.ts",
			},
		],
		dependsOn: [],
		outside: ["server"],
		issues: [
			{
				number: 12,
			},
			{
				number: 7,
			},
		],
	},
	reconnect: {
		name: "Reconnect & backoff",
		icon: "refresh",
		tagline: "Waits longer after each failed attempt",
		summary:
			"When the connection drops, the client waits before trying again, and waits longer each time, so a server coming back is not flooded.",
		paths: ["src/backoff.ts", "src/__tests__/backoff**"],
		flow: [
			{
				kind: "client",
				label: "Connection closes",
				note: "The transport reports a close; the client schedules a retry.",
				path: "src/client.ts",
			},
			{
				kind: "client",
				label: "nextDelay",
				note: "Turns the attempt number into a delay, doubling from 250 ms.",
				path: "src/backoff.ts",
			},
			{
				kind: "tool",
				label: "Backoff tests",
				note: "Pin the delays so a change to the curve is deliberate.",
				path: "src/__tests__/backoff.test.ts",
			},
		],
		features: [
			{
				name: "Exponential delay",
				summary: "Each failed attempt doubles the wait, up to a cap.",
				path: "src/backoff.ts",
			},
		],
		dependsOn: [],
		outside: [],
		issues: [
			{
				number: 9,
			},
			{
				number: 17,
			},
		],
	},
	release: {
		name: "CI & releases",
		icon: "actions",
		tagline: "Workflows, changelog and package settings",
		summary:
			"What runs on every pull request and what publishes a version: two workflows, the changelog and the package manifest.",
		paths: [".github/**", "{CHANGELOG.md,package.json,tsconfig.json}"],
		flow: [
			{
				kind: "tool",
				label: "CI workflow",
				note: "Type-checks and tests every pull request.",
				path: ".github/workflows/ci.yml",
			},
			{
				kind: "tool",
				label: "Release workflow",
				note: "Publishes the package when a version tag is pushed.",
				path: ".github/workflows/release.yml",
			},
			{
				kind: "external",
				label: "npm",
				note: "Where the published package lands.",
			},
		],
		features: [
			{
				name: "Changelog",
				summary: "One entry per released version.",
				path: "CHANGELOG.md",
			},
		],
		dependsOn: [],
		outside: ["npm"],
	},
};

const json = (value: object) => `${JSON.stringify(value, null, "\t")}\n`;

/** Repository path to file text, ready to drop into a seeded commit. */
export const beaconProductMapFiles: Record<string, string> = {
	".diffkit/map.json": json(index),
	...Object.fromEntries(
		Object.entries(areas).map(([id, area]) => [
			`.diffkit/areas/${id}.json`,
			json(area),
		]),
	),
};
