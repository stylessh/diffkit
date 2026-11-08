import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startFetch = vi.hoisted(() => vi.fn());
const handleCommentMediaUpload = vi.hoisted(() => vi.fn());
const runScheduledMaintenance = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: startFetch },
}));
vi.mock("#/lib/comment-media-upload.handler", () => ({
	handleCommentMediaUpload,
}));
vi.mock("#/lib/scheduled-maintenance.server", () => ({
	runScheduledMaintenance,
}));

const { default: worker } = await import("./entry-worker");

const env = {};
const ctx = {} as ExecutionContext;

function request(path: string, init?: RequestInit) {
	return new Request(`https://diffkit.test${path}`, init);
}

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
});

describe("entry worker fetch", () => {
	it("keeps redirects working when it adds security headers", async () => {
		startFetch.mockResolvedValue(
			Response.redirect("https://diffkit.test/login", 302),
		);
		const response = await worker.fetch(request("/"), env, ctx);
		expect(response.status).toBe(302);
		expect(response.headers.get("Strict-Transport-Security")).toBeTruthy();
	});

	it("sends only POST /api/comment-media/upload to the upload handler", async () => {
		handleCommentMediaUpload.mockResolvedValue(Response.json({ ok: true }));
		startFetch.mockResolvedValue(new Response("app"));

		await worker.fetch(
			request("/api/comment-media/upload", { method: "POST" }),
			env,
			ctx,
		);
		await worker.fetch(request("/api/comment-media/upload"), env, ctx);

		expect(handleCommentMediaUpload).toHaveBeenCalledTimes(1);
		expect(startFetch).toHaveBeenCalledTimes(1);
	});

	it("turns an unhandled error into a logged, retryable 503 without leaking it", async () => {
		startFetch.mockRejectedValue(
			new Error("Failed query: select\nparams: ghu_SECRETSECRETSECRET1"),
		);

		const response = await worker.fetch(request("/api/changes"), env, ctx);

		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("5");
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(await response.json()).toEqual({ error: "service_unavailable" });
		expect(String(vi.mocked(console.error).mock.calls[0][0])).not.toContain(
			"SECRET",
		);
	});
});

describe("entry worker scheduled", () => {
	it("never rejects, so a failing cron cannot take the Worker down", async () => {
		runScheduledMaintenance.mockRejectedValue(new Error("D1 unavailable"));
		const pending: Promise<unknown>[] = [];
		const context = {
			waitUntil: (promise: Promise<unknown>) => pending.push(promise),
		} as unknown as ExecutionContext;

		await worker.scheduled(
			{ scheduledTime: 1234 } as ScheduledController,
			{ DB: {} as D1Database },
			context,
		);

		await expect(Promise.all(pending)).resolves.toBeDefined();
		expect(console.error).toHaveBeenCalled();
	});
});
