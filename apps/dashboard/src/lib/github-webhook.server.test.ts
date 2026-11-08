import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyGitHubWebhookSignature } from "./github-app.server";
import {
	type GitHubWebhookDeps,
	handleGitHubWebhook,
	MAX_WEBHOOK_BODY_BYTES,
} from "./github-webhook.server";

vi.mock("cloudflare:workers", () => ({ env: {}, waitUntil: vi.fn() }));
vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("./github-emulator.server", () => ({
	getGitHubOAuthOrigin: () => "https://github.com",
}));

const SECRET = "webhook-secret";
const NOW = 1_800_000_000_000;

async function sign(body: string, secret = SECRET) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const bytes = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
	);
	return `sha256=${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function webhook(
	event: string | null,
	payload: unknown,
	options: {
		signature?: string | null;
		rawBody?: string;
		headers?: HeadersInit;
	} = {},
) {
	const body = options.rawBody ?? JSON.stringify(payload);
	const headers = new Headers(options.headers);
	if (event !== null) headers.set("x-github-event", event);
	headers.set("x-github-delivery", "delivery-1");
	const signature =
		options.signature === undefined ? await sign(body) : options.signature;
	if (signature !== null) headers.set("x-hub-signature-256", signature);
	return new Request("https://diffkit.test/api/webhooks/github", {
		method: "POST",
		headers,
		body,
	});
}

function setup(overrides: Partial<GitHubWebhookDeps> = {}) {
	const background: Promise<unknown>[] = [];
	const deps = {
		getSecret: () => SECRET,
		verifySignature: verifyGitHubWebhookSignature,
		invalidateInstallationToken: vi.fn(async () => undefined),
		recordChanges: vi.fn(async () => undefined),
		runInBackground: vi.fn((task: Promise<unknown>) => {
			background.push(task);
		}),
		now: () => NOW,
		...overrides,
	} satisfies GitHubWebhookDeps;
	return { deps, settled: () => Promise.all(background) };
}

const pullRequestPayload = {
	action: "opened",
	number: 12,
	pull_request: { number: 12 },
	repository: { name: "Api", private: true, owner: { login: "Acme" } },
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("handleGitHubWebhook: bad requests are 4xx, never 5xx", () => {
	it("503s when the secret is not configured", async () => {
		const { deps } = setup({ getSecret: () => null });
		const response = await handleGitHubWebhook(await webhook("push", {}), deps);
		expect(response.status).toBe(503);
	});

	it("401s missing, malformed, wrong-secret and tampered signatures", async () => {
		const wrongSecret = await sign("{}", "other-secret");
		const signedForOtherBody = await sign('{"a":1}');
		const cases: Array<[string | null, string]> = [
			[null, "{}"],
			["", "{}"],
			["sha256=", "{}"],
			["sha1=abc", "{}"],
			[wrongSecret, "{}"],
			[signedForOtherBody, '{"a":2}'],
		];
		for (const [signature, rawBody] of cases) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook("push", null, { signature, rawBody }),
				deps,
			);
			expect(response.status, String(signature)).toBe(401);
			expect(deps.runInBackground).not.toHaveBeenCalled();
		}
	});

	it("401s when signature verification itself throws", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { deps } = setup({
			verifySignature: async () => {
				throw new Error("subtle crypto unavailable");
			},
		});
		const response = await handleGitHubWebhook(await webhook("push", {}), deps);
		expect(response.status).toBe(401);
	});

	it("400s a bad event header, invalid JSON and JSON that is not an object", async () => {
		const badEvents = [null, "Push", "push event", "../x", "a".repeat(80)];
		for (const event of badEvents) {
			const response = await handleGitHubWebhook(
				await webhook(event, {}),
				setup().deps,
			);
			expect(response.status, String(event)).toBe(400);
		}
		for (const rawBody of ["{not json", "null", "[]", '"text"', "42"]) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook("push", null, { rawBody }),
				deps,
			);
			expect(response.status, rawBody).toBe(400);
			expect(deps.runInBackground).not.toHaveBeenCalled();
		}
	});

	it("413s a streamed body above GitHub's cap, with or without a declared length", async () => {
		const chunk = new Uint8Array(1024 * 1024);
		let sent = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (sent > MAX_WEBHOOK_BODY_BYTES) return controller.close();
				sent += chunk.byteLength;
				controller.enqueue(chunk);
			},
		});
		const { deps } = setup();
		const response = await handleGitHubWebhook(
			new Request("https://diffkit.test/api/webhooks/github", {
				method: "POST",
				headers: {
					"x-github-event": "push",
					"x-hub-signature-256": "sha256=00",
				},
				body,
				duplex: "half",
			} as RequestInit),
			deps,
		);
		expect(response.status).toBe(413);
		expect(deps.runInBackground).not.toHaveBeenCalled();
	});
});

describe("handleGitHubWebhook: change recording", () => {
	it("answers 202 while the insert is still pending, then records the entity keys", async () => {
		let finishInsert: () => void = () => undefined;
		const { deps, settled } = setup({
			recordChanges: vi.fn(
				() =>
					new Promise<void>((resolve) => {
						finishInsert = resolve;
					}),
			),
		});

		const response = await handleGitHubWebhook(
			await webhook("pull_request", pullRequestPayload),
			deps,
		);

		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({
			ok: true,
			event: "pull_request",
			changes: 1,
		});
		finishInsert();
		await settled();
		expect(deps.recordChanges).toHaveBeenCalledWith([
			{
				repo: "acme/api",
				entityKey: "pull:acme/api#12",
				isPrivate: true,
				changedAt: NOW,
			},
		]);
	});

	it("treats a repo as public only when the payload says so", async () => {
		const recorded = async (repository: Record<string, unknown>) => {
			const { deps, settled } = setup();
			await handleGitHubWebhook(await webhook("push", { repository }), deps);
			await settled();
			return vi.mocked(deps.recordChanges).mock.calls[0][0][0].isPrivate;
		};
		const owner = { login: "oss" };
		expect(await recorded({ name: "lib", private: false, owner })).toBe(false);
		expect(await recorded({ name: "lib", owner })).toBe(true);
	});

	it.each([
		["async", async () => Promise.reject(new Error("Failed query\nparams: x"))],
		[
			"sync",
			() => {
				throw new Error("DB binding missing");
			},
		],
	])("answers 202 and logs when the insert fails (%s)", async (_name, fail) => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { deps, settled } = setup({ recordChanges: vi.fn(fail) });
		const response = await handleGitHubWebhook(
			await webhook("pull_request", pullRequestPayload),
			deps,
		);
		await settled();
		expect(response.status).toBe(202);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(warn.mock.calls)).not.toContain("params:");
	});

	it("accepts events and payloads the dashboard does not read without writing", async () => {
		const cases: Array<[string, unknown]> = [
			["ping", { zen: "Keep it logically awesome." }],
			["star", pullRequestPayload],
			["pull_request", { action: "opened" }],
			["push", { repository: "not-an-object" }],
		];
		for (const [event, payload] of cases) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook(event, payload),
				deps,
			);
			expect(response.status, event).toBe(202);
			expect(deps.runInBackground).not.toHaveBeenCalled();
		}
	});
});

describe("handleGitHubWebhook: installation events", () => {
	it("drops the cached installation token", async () => {
		for (const event of [
			"installation",
			"installation_repositories",
			"github_app_authorization",
		]) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook(event, { installation: { id: 4242 } }),
				deps,
			);
			expect(response.status).toBe(200);
			expect(deps.invalidateInstallationToken).toHaveBeenCalledWith(4242);
			expect(deps.runInBackground).not.toHaveBeenCalled();
		}
	});

	it("still answers 200 when invalidation fails", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { deps } = setup({
			invalidateInstallationToken: vi.fn(async () => {
				throw new Error("KV unavailable");
			}),
		});
		const response = await handleGitHubWebhook(
			await webhook("installation", { installation: { id: 1 } }),
			deps,
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			invalidatedInstallationToken: false,
		});
	});
});
