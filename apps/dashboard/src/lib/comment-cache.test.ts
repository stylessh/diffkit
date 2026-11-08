import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { commentQueryFilters, patchComment } from "./comment-cache";
import { githubQueryKeys } from "./github.query";

const scope = { userId: "u1" };
const comment = (id: number, body = `body ${id}`) => ({
	id,
	body,
	createdAt: "2026-11-01T00:00:00Z",
	author: null,
});

describe("patchComment", () => {
	it("edits a comment inside page data and leaves the rest untouched", () => {
		const page = { detail: { title: "x" }, comments: [comment(1), comment(2)] };
		const next = patchComment(page, 2, {
			type: "edit",
			body: "fixed",
			editedAt: "2026-11-08T00:00:00Z",
		});
		expect(next.comments[1]).toMatchObject({
			body: "fixed",
			editedAt: "2026-11-08T00:00:00Z",
		});
		expect(next.comments[0]).toBe(page.comments[0]);
		expect(next.detail).toBe(page.detail);
	});

	it("removes a comment from a comment page and its total", () => {
		const next = patchComment(
			{ comments: [comment(1), comment(2)], total: 40 },
			1,
			{
				type: "delete",
			},
		);
		expect(next).toEqual({ comments: [comment(2)], total: 39 });
	});

	it("returns the same reference when the comment isn't cached there", () => {
		const list = [comment(1)];
		expect(patchComment(list, 9, { type: "delete" })).toBe(list);
		expect(patchComment(undefined, 9, { type: "delete" })).toBeUndefined();
	});
});

describe("commentQueryFilters", () => {
	function matchingKeys(kind: "issue" | "review") {
		const queryClient = new QueryClient();
		const pull = { owner: "Acme", repo: "Web", pullNumber: 4 };
		const keys = [
			githubQueryKeys.pulls.page(scope, pull),
			githubQueryKeys.pulls.reviewComments(scope, pull),
			githubQueryKeys.commentPage(scope, {
				owner: "acme",
				repo: "web",
				issueNumber: 4,
				page: 2,
			}),
			githubQueryKeys.pulls.page(scope, { ...pull, pullNumber: 5 }),
			githubQueryKeys.pulls.page({ userId: "u2" }, pull),
		];
		for (const key of keys) queryClient.setQueryData(key, []);
		return queryClient
			.getQueriesData(
				commentQueryFilters(scope, {
					kind,
					owner: "acme",
					repo: "web",
					number: 4,
					commentId: 1,
				}),
			)
			.map(([key]) =>
				typeof key[3] === "string" ? `${key[2]}.${key[3]}` : String(key[2]),
			);
	}

	it("targets every conversation view of the item for issue comments", () => {
		expect(matchingKeys("issue").sort()).toEqual(["commentPage", "pulls.page"]);
	});

	it("targets only review comment lists for diff comments", () => {
		expect(matchingKeys("review")).toEqual(["pulls.reviewComments"]);
	});
});
