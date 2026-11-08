import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { githubQueryKeys } from "./github.query";
import type { PullSummary, RepoCommitsPage } from "./github.types";
import {
	cachedCommitReference,
	cachedItemReference,
} from "./reference-placeholders";

const scope = { userId: "u1" };
const ref = { owner: "acme", repo: "web", number: 12 };

function pull(overrides: Partial<PullSummary> = {}): PullSummary {
	return {
		id: 1,
		number: 12,
		title: "Fix login",
		state: "open",
		isDraft: false,
		createdAt: "2026-11-01T00:00:00Z",
		updatedAt: "2026-11-02T00:00:00Z",
		closedAt: null,
		mergedAt: null,
		comments: 3,
		url: "",
		author: { login: "ada", avatarUrl: "", url: "", type: "User" },
		labels: [],
		repository: {
			name: "web",
			owner: "acme",
			fullName: "acme/web",
			url: "",
			isPrivate: false,
		},
		...overrides,
	};
}

describe("cachedItemReference", () => {
	it("prefers an open detail page, with its body, over list rows", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(
			githubQueryKeys.pulls.repo(scope, { owner: "acme", repo: "web" }),
			[pull({ title: "Row title" })],
		);
		queryClient.setQueryData(
			githubQueryKeys.pulls.page(scope, {
				owner: "acme",
				repo: "web",
				pullNumber: 12,
			}),
			{
				detail: {
					...pull({ title: "Page title" }),
					body: "## Summary\n\n**Fixes** #12 for [SSO](https://x.test).\n\n- [x] Parses frames\n- [ ] Docs",
					isMerged: true,
				},
			},
		);

		expect(cachedItemReference(queryClient, scope, ref)).toMatchObject({
			kind: "pull",
			status: "merged",
			title: "Page title",
			excerpt: "Summary Fixes #12 for SSO. Parses frames Docs",
		});
	});

	it("seeds from a list row, which has no body to excerpt", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(
			githubQueryKeys.pulls.repo(scope, { owner: "acme", repo: "web" }),
			[pull({ isDraft: true })],
		);

		expect(cachedItemReference(queryClient, scope, ref)).toMatchObject({
			kind: "pull",
			status: "draft",
			excerpt: null,
		});
		expect(
			cachedItemReference(queryClient, scope, { ...ref, number: 13 }),
		).toBeUndefined();
	});
});

describe("cachedCommitReference", () => {
	it("matches a short SHA against a cached commit list for the same repo", () => {
		const queryClient = new QueryClient();
		const page: RepoCommitsPage = {
			commits: [
				{
					sha: "1a2b3c4d5e6f7a8b9c0d",
					message: "Fix login\n\nLonger body",
					date: "2026-11-01T00:00:00Z",
					author: null,
					authorName: "Ada",
					verified: true,
					commentCount: 0,
					url: "",
				},
			],
			hasNextPage: false,
			searched: false,
		};
		queryClient.setQueryData(
			githubQueryKeys.commits.list(scope, { owner: "Acme", repo: "Web" }),
			page,
		);

		expect(
			cachedCommitReference(queryClient, scope, {
				owner: "acme",
				repo: "web",
				sha: "1a2b3c4",
			}),
		).toMatchObject({ title: "Fix login", authorName: "Ada", stats: null });
		expect(
			cachedCommitReference(queryClient, scope, {
				owner: "acme",
				repo: "api",
				sha: "1a2b3c4",
			}),
		).toBeUndefined();
	});
});
