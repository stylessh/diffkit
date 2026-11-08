import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { githubQueryKeys } from "./github.query";
import type { IssueSummary, PullSummary } from "./github.types";
import {
	findIssueSummaryInLists,
	findPullSummaryInLists,
} from "./github-query-updates";

const scope = { userId: "u1" };

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
		comments: 0,
		url: "",
		author: { login: "ada", avatarUrl: "", url: "", type: "User" },
		labels: [],
		repository: {
			name: "Repo",
			owner: "Acme",
			fullName: "Acme/Repo",
			url: "",
			isPrivate: false,
		},
		...overrides,
	} as PullSummary;
}

describe("findPullSummaryInLists", () => {
	it("finds the freshest row across my-pulls and repo lists, ignoring case", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(githubQueryKeys.pulls.mine(scope), {
			reviewRequested: [pull({ title: "Old title" })],
			assigned: [],
			authored: [],
			mentioned: [],
			involved: [],
		});
		queryClient.setQueryData(
			githubQueryKeys.pulls.repo(scope, { owner: "acme", repo: "repo" }),
			[pull({ title: "New title", updatedAt: "2026-11-03T00:00:00Z" })],
		);

		expect(
			findPullSummaryInLists(queryClient, scope, {
				owner: "acme",
				repo: "REPO",
				pullNumber: 12,
			})?.title,
		).toBe("New title");
	});

	it("ignores other users, other repos and non-list queries", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(
			githubQueryKeys.pulls.repo(
				{ userId: "u2" },
				{ owner: "acme", repo: "repo" },
			),
			[pull()],
		);
		queryClient.setQueryData(
			githubQueryKeys.pulls.repo(scope, { owner: "acme", repo: "other" }),
			[pull({ repository: { ...pull().repository, name: "other" } })],
		);
		expect(
			findPullSummaryInLists(queryClient, scope, {
				owner: "acme",
				repo: "repo",
				pullNumber: 12,
			}),
		).toBeUndefined();
	});
});

describe("findIssueSummaryInLists", () => {
	it("finds an issue row in my issues", () => {
		const queryClient = new QueryClient();
		const issue = {
			...pull({ number: 4, title: "Crash" }),
			stateReason: null,
		} as unknown as IssueSummary;
		queryClient.setQueryData(githubQueryKeys.issues.mine(scope), {
			assigned: [issue],
			authored: [],
			mentioned: [],
		});
		expect(
			findIssueSummaryInLists(queryClient, scope, {
				owner: "Acme",
				repo: "Repo",
				issueNumber: 4,
			})?.title,
		).toBe("Crash");
	});
});
