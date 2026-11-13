import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startFetch = vi.hoisted(() => vi.fn());
const handleCommentMediaUpload = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: startFetch },
}));
vi.mock("#/lib/comment-media-upload.handler", () => ({
	handleCommentMediaUpload,
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

	it("refuses a server-function request that a page element could have made", async () => {
		startFetch.mockResolvedValue(new Response("app"));

		const fromImageOrLink = await worker.fetch(
			request("/_serverFn/abc?payload=%7B%7D", {
				headers: { "sec-fetch-site": "same-origin", cookie: "session=1" },
			}),
			env,
			ctx,
		);
		const fromAppClient = await worker.fetch(
			request("/_serverFn/abc?payload=%7B%7D", {
				headers: { "x-tsr-serverFn": "true" },
			}),
			env,
			ctx,
		);

		expect(fromImageOrLink.status).toBe(403);
		expect(fromImageOrLink.headers.get("X-Frame-Options")).toBe("DENY");
		expect(fromAppClient.status).toBe(200);
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
