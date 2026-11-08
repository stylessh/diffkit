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
const ctx = {
	waitUntil: vi.fn(),
	passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

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
	it("passes requests to the app and adds security headers", async () => {
		startFetch.mockResolvedValue(new Response("page"));
		const response = await worker.fetch(request("/pulls"), env, ctx);
		expect(await response.text()).toBe("page");
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(startFetch).toHaveBeenCalledWith(expect.any(Request), env, ctx);
	});

	it("adds security headers to redirects with immutable headers", async () => {
		startFetch.mockResolvedValue(
			Response.redirect("https://diffkit.test/login", 302),
		);
		const response = await worker.fetch(request("/"), env, ctx);
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://diffkit.test/login");
		expect(response.headers.get("Strict-Transport-Security")).toBeTruthy();
	});

	it("routes POST /api/comment-media/upload to the upload handler only", async () => {
		handleCommentMediaUpload.mockResolvedValue(Response.json({ ok: true }));
		const upload = await worker.fetch(
			request("/api/comment-media/upload", { method: "POST" }),
			env,
			ctx,
		);
		expect(upload.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(handleCommentMediaUpload).toHaveBeenCalledTimes(1);
		expect(startFetch).not.toHaveBeenCalled();

		startFetch.mockResolvedValue(new Response("app"));
		await worker.fetch(request("/api/comment-media/upload"), env, ctx);
		expect(handleCommentMediaUpload).toHaveBeenCalledTimes(1);
		expect(startFetch).toHaveBeenCalledTimes(1);
	});

	it("turns an unhandled app error into a logged, retryable 503", async () => {
		startFetch.mockRejectedValue(
			new Error("Failed query: select\nparams: ghu_SECRETSECRETSECRET1"),
		);
		const response = await worker.fetch(request("/api/changes"), env, ctx);
		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("5");
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(await response.json()).toEqual({ error: "service_unavailable" });

		const logged = String(vi.mocked(console.error).mock.calls[0][0]);
		expect(JSON.parse(logged)).toMatchObject({
			level: "error",
			scope: "worker",
			pathname: "/api/changes",
			method: "GET",
		});
		expect(logged).not.toContain("SECRET");
	});

	it("serves a text 503 for page requests", async () => {
		startFetch.mockRejectedValue(new Error("boom"));
		const response = await worker.fetch(request("/pulls"), env, ctx);
		expect(response.status).toBe(503);
		expect(response.headers.get("Content-Type")).toContain("text/plain");
	});

	it("also guards the upload handler", async () => {
		handleCommentMediaUpload.mockRejectedValue(new Error("R2 down"));
		const response = await worker.fetch(
			request("/api/comment-media/upload", { method: "POST" }),
			env,
			ctx,
		);
		expect(response.status).toBe(503);
	});
});

describe("entry worker scheduled", () => {
	const controller = { scheduledTime: 1234 } as ScheduledController;

	async function run() {
		const pending: Promise<unknown>[] = [];
		const context = {
			waitUntil: (promise: Promise<unknown>) => pending.push(promise),
		} as unknown as ExecutionContext;
		await worker.scheduled(controller, { DB: {} as D1Database }, context);
		await Promise.all(pending);
	}

	it("runs maintenance with the scheduled time", async () => {
		runScheduledMaintenance.mockResolvedValue({});
		await run();
		expect(runScheduledMaintenance).toHaveBeenCalledWith(
			expect.anything(),
			1234,
		);
	});

	it("never rejects, so a failing cron cannot take the Worker down", async () => {
		runScheduledMaintenance.mockRejectedValue(new Error("D1 unavailable"));
		await expect(run()).resolves.toBeUndefined();
		expect(console.error).toHaveBeenCalled();
	});
});
