import { describe, expect, it } from "vitest";
import type { RepoViewerPermission } from "./github.types";
import {
	buildCreatePullRequestInput,
	emptyPullRequestDraft,
	type PullRequestDraft,
	pullRequestAccess,
	pullRequestDraftReducer,
	suggestPullRequestTitle,
} from "./pull-request-draft";

const octocat = {
	login: "octocat",
	avatarUrl: "",
	url: "",
	type: "User",
	permissions: { admin: false, push: true, pull: true },
};

const base = {
	owner: "acme",
	repo: "api",
	base: "main",
	head: "feat/jitter-backoff",
	titleSuggestion: "Jitter backoff",
	bodyTemplate: "## Summary",
};

function input(draft: Partial<PullRequestDraft> = {}, overrides = {}) {
	return buildCreatePullRequestInput({
		...base,
		...overrides,
		draft: { ...emptyPullRequestDraft, ...draft },
	});
}

describe("suggestPullRequestTitle", () => {
	it("uses the subject of the only commit", () => {
		expect(
			suggestPullRequestTitle(
				[{ message: "Add retry jitter\n\nLonger explanation" }],
				"feat/jitter-backoff",
			),
		).toBe("Add retry jitter");
	});

	it("falls back to the branch name for several commits", () => {
		expect(
			suggestPullRequestTitle(
				[{ message: "wip" }, { message: "more wip" }],
				"feat-jitter_backoff",
			),
		).toBe("Feat jitter backoff");
	});

	it("falls back to the branch name when the only commit has no subject", () => {
		expect(
			suggestPullRequestTitle([{ message: "\n\nbody only" }], "cleanup"),
		).toBe("Cleanup");
	});

	it("drops the fork owner from a cross-fork head", () => {
		expect(suggestPullRequestTitle([], "octocat:fix-reconnect")).toBe(
			"Fix reconnect",
		);
	});
});

describe("buildCreatePullRequestInput", () => {
	it("submits the suggestion and template until the user edits them", () => {
		expect(input()).toMatchObject({
			title: "Jitter backoff",
			body: "## Summary",
			draft: false,
		});
		expect(
			input({ editedTitle: "Own title", editedBody: "Own body" }),
		).toMatchObject({ title: "Own title", body: "Own body" });
	});

	it("keeps a body the user cleared empty instead of restoring the template", () => {
		expect(input({ editedBody: "" })?.body).toBeUndefined();
	});

	it("refuses a blank title", () => {
		expect(input({ editedTitle: "   " })).toBeNull();
	});

	it("maps selections to the names GitHub expects and omits empty ones", () => {
		const payload = input({
			isDraft: true,
			labels: [{ name: "bug", color: "d73a4a", description: null }],
			assignees: [octocat],
			reviewers: [octocat],
			teamReviewers: [{ slug: "core", name: "Core" }],
			milestone: {
				number: 3,
				title: "v2",
				dueOn: null,
				openIssues: 1,
				closedIssues: 0,
			},
		});
		expect(payload).toMatchObject({
			draft: true,
			labels: ["bug"],
			assignees: ["octocat"],
			reviewers: ["octocat"],
			teamReviewers: ["core"],
			milestone: 3,
		});
		const bare = input();
		expect(bare?.labels).toBeUndefined();
		expect(bare?.assignees).toBeUndefined();
		expect(bare?.reviewers).toBeUndefined();
		expect(bare?.teamReviewers).toBeUndefined();
		expect(bare?.milestone).toBeUndefined();
	});

	it("passes a cross-fork head through unchanged", () => {
		expect(input({}, { head: "octocat:feature" })?.head).toBe(
			"octocat:feature",
		);
	});
});

describe("pullRequestAccess", () => {
	const write: RepoViewerPermission = { permission: "WRITE", canPush: true };
	const read: RepoViewerPermission = { permission: "READ", canPush: false };
	const args = { head: "feature", repoOwner: "acme" };

	it("waits for the permission before deciding", () => {
		expect(pullRequestAccess({ ...args, permission: undefined })).toBe(
			"checking",
		);
	});

	it("allows anyone with push access", () => {
		expect(pullRequestAccess({ ...args, permission: write })).toBe("allowed");
	});

	it("blocks a reader proposing a branch of the repository itself", () => {
		expect(pullRequestAccess({ ...args, permission: read })).toBe("read-only");
	});

	it("allows a reader proposing from a fork, without waiting for the permission", () => {
		expect(
			pullRequestAccess({ ...args, head: "octocat:feature", permission: read }),
		).toBe("allowed");
		expect(
			pullRequestAccess({
				...args,
				head: "octocat:feature",
				permission: undefined,
			}),
		).toBe("allowed");
	});
});

describe("pullRequestDraftReducer", () => {
	it("toggles a selection on and off by identity", () => {
		const added = pullRequestDraftReducer(emptyPullRequestDraft, {
			type: "reviewer-toggled",
			reviewer: octocat,
		});
		expect(added.reviewers).toEqual([octocat]);
		const removed = pullRequestDraftReducer(added, {
			type: "reviewer-toggled",
			reviewer: { ...octocat },
		});
		expect(removed.reviewers).toEqual([]);
	});
});
