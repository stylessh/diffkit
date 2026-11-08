import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maxBytesForCommentMediaKind } from "./comment-media.server";
import {
	type CommentMediaUploadRuntime,
	handleCommentMediaUpload,
} from "./comment-media-upload.handler";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function setup(overrides: Partial<CommentMediaUploadRuntime> = {}) {
	const put = vi.fn(async () => ({}));
	const runtime: CommentMediaUploadRuntime = {
		storage: {
			bucket: { put } as unknown as Pick<R2Bucket, "put">,
			publicBaseUrl: "https://cdn.test",
		},
		getSession: async () => ({ user: { id: "user-1" } }),
		...overrides,
	};
	return { runtime, put };
}

function upload(
	file: Blob | null,
	options: { name?: string; headers?: HeadersInit } = {},
) {
	const form = new FormData();
	if (file) form.set("file", new File([file], options.name ?? "shot.png"));
	return new Request("https://diffkit.test/api/comment-media/upload", {
		method: "POST",
		body: form,
		headers: options.headers,
	});
}

const png = (extra = 32) =>
	new Blob([new Uint8Array([...PNG, ...new Array(extra).fill(1)])]);

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe("handleCommentMediaUpload", () => {
	it("stores the file under the user's prefix with the detected content type", async () => {
		const { runtime, put } = setup();
		const form = new FormData();
		form.set("file", new File([png()], "evil.html", { type: "text/html" }));
		const response = await handleCommentMediaUpload(
			new Request("https://diffkit.test/api/comment-media/upload", {
				method: "POST",
				body: form,
			}),
			runtime,
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, string>;
		expect(body).toMatchObject({ kind: "image", contentType: "image/png" });
		expect(body.key).toMatch(
			/^comment-media\/user-1\/\d+-[0-9a-f-]{36}-evil\.html$/,
		);
		expect(body.publicUrl).toBe(`https://cdn.test/${body.key}`);
		expect(put).toHaveBeenCalledWith(
			body.key,
			expect.anything(),
			expect.objectContaining({
				httpMetadata: expect.objectContaining({ contentType: "image/png" }),
			}),
		);
	});

	it("401s without a session and 503s when the session store is down", async () => {
		const signedOut = setup({ getSession: async () => null });
		expect(
			(await handleCommentMediaUpload(upload(png()), signedOut.runtime)).status,
		).toBe(401);

		const down = setup({
			getSession: async () => {
				throw new Error("D1_ERROR");
			},
		});
		const response = await handleCommentMediaUpload(
			upload(png()),
			down.runtime,
		);
		expect(response.status).toBe(503);
		expect(down.put).not.toHaveBeenCalled();
	});

	it("413s on a declared size above the video cap before parsing the body", async () => {
		const { runtime, put } = setup();
		const request = upload(png(), {
			headers: {
				"Content-Length": String(
					maxBytesForCommentMediaKind("video") + 2 * 1024 * 1024,
				),
			},
		});
		const formData = vi.spyOn(request, "formData");
		const response = await handleCommentMediaUpload(request, runtime);
		expect(response.status).toBe(413);
		expect(formData).not.toHaveBeenCalled();
		expect(put).not.toHaveBeenCalled();
	});

	it("400s a non-multipart body and a broken multipart body", async () => {
		const { runtime } = setup();
		const json = await handleCommentMediaUpload(
			new Request("https://diffkit.test/u", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			}),
			runtime,
		);
		expect(json.status).toBe(400);

		const broken = await handleCommentMediaUpload(
			new Request("https://diffkit.test/u", {
				method: "POST",
				headers: { "Content-Type": "multipart/form-data; boundary=xyz" },
				body: "this is not multipart",
			}),
			runtime,
		);
		expect(broken.status).toBe(400);
	});

	it("400s a missing file and 415s unsupported content", async () => {
		const { runtime, put } = setup();
		expect((await handleCommentMediaUpload(upload(null), runtime)).status).toBe(
			400,
		);
		const svg = new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"]);
		expect(
			(await handleCommentMediaUpload(upload(svg, { name: "a.svg" }), runtime))
				.status,
		).toBe(415);
		expect(put).not.toHaveBeenCalled();
	});

	it("502s when R2 rejects the write", async () => {
		const failing = setup();
		failing.runtime.storage = {
			bucket: {
				put: async () => {
					throw new Error("R2 put failed: 503");
				},
			} as unknown as Pick<R2Bucket, "put">,
			publicBaseUrl: "https://cdn.test",
		};
		const response = await handleCommentMediaUpload(
			upload(png()),
			failing.runtime,
		);
		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Upload failed" });
	});
});
