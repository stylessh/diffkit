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

describe("handleGitHubWebhook: rejecting bad requests with 4xx", () => {
	it("503s when the secret is not configured, before reading anything", async () => {
		const { deps } = setup({ getSecret: () => null });
		const response = await handleGitHubWebhook(await webhook("push", {}), deps);
		expect(response.status).toBe(503);
		expect(deps.recordChanges).not.toHaveBeenCalled();
	});

	it("401s a missing, malformed or wrong signature", async () => {
		const wrongSecret = await sign("{}", "other-secret");
		for (const signature of [
			null,
			"",
			"sha256=",
			"nope",
			"sha1=abc",
			wrongSecret,
		]) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook("push", {}, { signature, rawBody: "{}" }),
				deps,
			);
			expect(response.status).toBe(401);
			expect(deps.runInBackground).not.toHaveBeenCalled();
		}
	});

	it("401s when the body was changed after signing", async () => {
		const { deps } = setup();
		const signature = await sign('{"a":1}');
		const response = await handleGitHubWebhook(
			await webhook("push", null, { signature, rawBody: '{"a":2}' }),
			deps,
		);
		expect(response.status).toBe(401);
	});

	it("401s instead of 500 when signature verification itself throws", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { deps } = setup({
			verifySignature: async () => {
				throw new Error("subtle crypto unavailable");
			},
		});
		const response = await handleGitHubWebhook(await webhook("push", {}), deps);
		expect(response.status).toBe(401);
	});

	it("400s a missing or malformed event header (after the signature check)", async () => {
		for (const event of [
			null,
			"",
			"Push",
			"push event",
			"../x",
			"a".repeat(80),
		]) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook(
					event,
					{},
					event === "" ? { headers: { "x-github-event": "" } } : {},
				),
				deps,
			);
			expect(response.status).toBe(400);
		}
	});

	it("400s invalid JSON", async () => {
		const { deps } = setup();
		const response = await handleGitHubWebhook(
			await webhook("push", null, { rawBody: "{not json" }),
			deps,
		);
		expect(response.status).toBe(400);
		expect(await response.text()).toMatch(/JSON/);
	});

	it("400s JSON that is not an object", async () => {
		for (const rawBody of ["null", "[]", "[1,2]", '"text"', "42", "true"]) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook("push", null, { rawBody }),
				deps,
			);
			expect(response.status, rawBody).toBe(400);
			expect(deps.runInBackground).not.toHaveBeenCalled();
		}
	});

	it("413s a declared payload above GitHub's cap without reading it", async () => {
		const { deps } = setup();
		const request = await webhook(
			"push",
			{},
			{
				headers: { "content-length": String(MAX_WEBHOOK_BODY_BYTES + 1) },
			},
		);
		const response = await handleGitHubWebhook(request, deps);
		expect(response.status).toBe(413);
	});
});

describe("handleGitHubWebhook: change recording", () => {
	it("records entity keys in the background and answers 202 immediately", async () => {
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

		// Answered while the insert is still pending: nothing awaits D1.
		expect(response.status).toBe(202);
		expect(await response.json()).toEqual({
			ok: true,
			event: "pull_request",
			changes: 2,
		});
		expect(deps.runInBackground).toHaveBeenCalledTimes(1);
		finishInsert();
		await settled();

		expect(deps.recordChanges).toHaveBeenCalledWith([
			{
				repo: "acme/api",
				entityKey: "pull:acme/api#12",
				isPrivate: true,
				changedAt: NOW,
			},
			{
				repo: "acme/api",
				entityKey: "notifications",
				isPrivate: true,
				changedAt: NOW,
			},
		]);
	});

	it("marks rows public only when the payload says the repo is public", async () => {
		const { deps, settled } = setup();
		await handleGitHubWebhook(
			await webhook("push", {
				repository: { name: "lib", private: false, owner: { login: "oss" } },
			}),
			deps,
		);
		await settled();
		expect(deps.recordChanges).toHaveBeenCalledWith([
			{
				repo: "oss/lib",
				entityKey: "repo:oss/lib",
				isPrivate: false,
				changedAt: NOW,
			},
		]);

		const unknownVisibility = setup();
		await handleGitHubWebhook(
			await webhook("push", {
				repository: { name: "lib", owner: { login: "oss" } },
			}),
			unknownVisibility.deps,
		);
		await unknownVisibility.settled();
		expect(unknownVisibility.deps.recordChanges).toHaveBeenCalledWith([
			expect.objectContaining({ isPrivate: true }),
		]);
	});

	it("answers 202 and logs when the insert fails (D1 full, outage)", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { deps, settled } = setup({
			recordChanges: vi.fn(async () => {
				throw new Error('Failed query: insert into "github_change"\nparams: x');
			}),
		});
		const response = await handleGitHubWebhook(
			await webhook("pull_request", pullRequestPayload),
			deps,
		);
		await settled();
		expect(response.status).toBe(202);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(warn.mock.calls)).not.toContain("params:");
	});

	it("answers 202 when the insert throws synchronously", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { deps, settled } = setup({
			recordChanges: vi.fn(() => {
				throw new Error("DB binding missing");
			}),
		});
		const response = await handleGitHubWebhook(
			await webhook("pull_request", pullRequestPayload),
			deps,
		);
		await settled();
		expect(response.status).toBe(202);
	});

	it("accepts events and payloads the dashboard does not read without writing", async () => {
		const cases: Array<[string, unknown]> = [
			["ping", { zen: "Keep it logically awesome.", hook_id: 1 }],
			["star", pullRequestPayload],
			["pull_request", { ...pullRequestPayload, pull_request: {} }],
			["pull_request", { action: "opened" }],
			["push", { repository: "not-an-object" }],
			["push", { repository: { name: 1, owner: { login: "x" } } }],
		];
		for (const [event, payload] of cases) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook(event, payload),
				deps,
			);
			expect(response.status, event).toBe(202);
			expect(await response.json()).toMatchObject({ changes: 0 });
			expect(deps.runInBackground).not.toHaveBeenCalled();
		}
	});

	it("maps workflow and check events to their entities", async () => {
		const { deps, settled } = setup();
		await handleGitHubWebhook(
			await webhook("check_run", {
				repository: { name: "api", private: true, owner: { login: "acme" } },
				check_run: {
					head_sha: "ABCDEF1234567",
					pull_requests: [{ number: 3 }, { number: 3 }, { nope: true }],
				},
			}),
			deps,
		);
		await settled();
		const rows = vi.mocked(deps.recordChanges).mock.calls[0][0];
		expect(rows.map((row) => row.entityKey)).toEqual([
			"checks:acme/api@abcdef1234567",
			"pull:acme/api#3",
		]);
	});
});

describe("handleGitHubWebhook: installation events", () => {
	const installation = (id: unknown) => ({
		action: "created",
		installation: { id },
	});

	it("drops the cached installation token", async () => {
		for (const event of [
			"installation",
			"installation_repositories",
			"github_app_authorization",
		]) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook(event, installation(4242)),
				deps,
			);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				ok: true,
				event,
				invalidatedInstallationToken: true,
			});
			expect(deps.invalidateInstallationToken).toHaveBeenCalledWith(4242);
			expect(deps.runInBackground).not.toHaveBeenCalled();
		}
	});

	it("ignores installation ids that are not integers", async () => {
		for (const id of ["4242", 1.5, null, {}, undefined]) {
			const { deps } = setup();
			const response = await handleGitHubWebhook(
				await webhook("installation", installation(id)),
				deps,
			);
			expect(response.status).toBe(200);
			expect(deps.invalidateInstallationToken).not.toHaveBeenCalled();
			expect(await response.json()).toMatchObject({
				invalidatedInstallationToken: false,
			});
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
			await webhook("installation", installation(1)),
			deps,
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			invalidatedInstallationToken: false,
		});
	});
});
