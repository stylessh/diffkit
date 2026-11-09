import { RequestError } from "octokit";
import { describe, expect, it } from "vitest";
import {
	handlePullDiffRequest,
	type PullDiffRequestDeps,
} from "./pull-diff-request.server";

const DIFF =
	"diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n";

function stream(text: string) {
	return new Response(text).body as ReadableStream<Uint8Array>;
}

function githubError(status: number, data: unknown) {
	return new RequestError("refused", status, {
		request: { method: "GET", url: "https://api.github.com/x", headers: {} },
		response: { status, url: "https://api.github.com/x", headers: {}, data },
	});
}

const tooLarge = githubError(406, {
	message: "Sorry, the diff exceeded the maximum number of files (300).",
	errors: [{ resource: "PullRequest", field: "diff", code: "too_large" }],
});

function get(query = "owner=lumen-labs&repo=atlas&number=1") {
	return new Request(`https://diffkit.test/api/pulls/diff?${query}`);
}

function deps(overrides: Partial<PullDiffRequestDeps>): PullDiffRequestDeps {
	return {
		fetchApiDiff: async () => ({ kind: "diff", body: stream(DIFF) }),
		fetchPublicDiff: null,
		...overrides,
	};
}

describe("handlePullDiffRequest", () => {
	it("streams GitHub's diff through as plain text", async () => {
		const response = await handlePullDiffRequest(get(), deps({}));
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe(
			"text/plain; charset=utf-8",
		);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(await response.text()).toBe(DIFF);
	});

	it("falls back to the public diff, then to too_large, when GitHub refuses the size", async () => {
		const refusing = { fetchApiDiff: () => Promise.reject(tooLarge) };

		const publicDiff = await handlePullDiffRequest(
			get(),
			deps({
				...refusing,
				fetchPublicDiff: async () =>
					new Response(DIFF, {
						headers: { "Content-Type": "text/plain; charset=utf-8" },
					}),
			}),
		);
		expect(publicDiff.headers.get("X-Diff-Source")).toBe("public");
		expect(await publicDiff.text()).toBe(DIFF);

		const privateRepo = await handlePullDiffRequest(
			get(),
			deps({
				...refusing,
				fetchPublicDiff: async () => new Response("Not Found", { status: 404 }),
			}),
		);
		expect(privateRepo.status).toBe(413);
		expect(await privateRepo.json()).toEqual({ reason: "too_large" });

		const demoMode = await handlePullDiffRequest(get(), deps(refusing));
		expect(demoMode.status).toBe(413);
	});

	it("maps other refusals and rejects malformed input", async () => {
		const refused = (status: number) =>
			handlePullDiffRequest(
				get(),
				deps({
					fetchApiDiff: () => Promise.reject(githubError(status, {})),
				}),
			);
		expect(await (await refused(404)).json()).toEqual({ reason: "not_found" });
		expect((await refused(403)).status).toBe(403);
		await expect(refused(502)).rejects.toBeInstanceOf(RequestError);

		const signedOut = await handlePullDiffRequest(
			get(),
			deps({ fetchApiDiff: async () => ({ kind: "unauthenticated" }) }),
		);
		expect(signedOut.status).toBe(401);

		for (const query of [
			"owner=a/b&repo=atlas&number=1",
			"owner=..&repo=atlas&number=1",
			"owner=lumen-labs&repo=.&number=1",
		]) {
			const malformed = await handlePullDiffRequest(get(query), deps({}));
			expect(malformed.status).toBe(400);
		}
	});
});
