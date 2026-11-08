import { isForkRef, splitCompareRef } from "./compare-ref";
import type { CreatePullRequestInput } from "./github.functions";
import type {
	GitHubLabel,
	OrgTeam,
	RepoCollaborator,
	RepoMilestone,
	RepoViewerPermission,
} from "./github.types";

export type PullRequestDraft = {
	editedTitle: string | null;
	editedBody: string | null;
	isDraft: boolean;
	labels: GitHubLabel[];
	assignees: RepoCollaborator[];
	reviewers: RepoCollaborator[];
	teamReviewers: OrgTeam[];
	milestone: RepoMilestone | null;
};

export const emptyPullRequestDraft: PullRequestDraft = {
	editedTitle: null,
	editedBody: null,
	isDraft: false,
	labels: [],
	assignees: [],
	reviewers: [],
	teamReviewers: [],
	milestone: null,
};

export type PullRequestDraftAction =
	| { type: "title-edited"; value: string }
	| { type: "body-edited"; value: string }
	| { type: "draft-set"; value: boolean }
	| { type: "label-toggled"; label: GitHubLabel }
	| { type: "assignee-toggled"; assignee: RepoCollaborator }
	| { type: "reviewer-toggled"; reviewer: RepoCollaborator }
	| { type: "team-reviewer-toggled"; team: OrgTeam }
	| { type: "milestone-selected"; milestone: RepoMilestone | null };

function toggled<T>(list: T[], item: T, same: (a: T, b: T) => boolean) {
	return list.some((existing) => same(existing, item))
		? list.filter((existing) => !same(existing, item))
		: [...list, item];
}

export function pullRequestDraftReducer(
	draft: PullRequestDraft,
	action: PullRequestDraftAction,
): PullRequestDraft {
	switch (action.type) {
		case "title-edited":
			return { ...draft, editedTitle: action.value };
		case "body-edited":
			return { ...draft, editedBody: action.value };
		case "draft-set":
			return { ...draft, isDraft: action.value };
		case "label-toggled":
			return {
				...draft,
				labels: toggled(
					draft.labels,
					action.label,
					(a, b) => a.name === b.name,
				),
			};
		case "assignee-toggled":
			return {
				...draft,
				assignees: toggled(
					draft.assignees,
					action.assignee,
					(a, b) => a.login === b.login,
				),
			};
		case "reviewer-toggled":
			return {
				...draft,
				reviewers: toggled(
					draft.reviewers,
					action.reviewer,
					(a, b) => a.login === b.login,
				),
			};
		case "team-reviewer-toggled":
			return {
				...draft,
				teamReviewers: toggled(
					draft.teamReviewers,
					action.team,
					(a, b) => a.slug === b.slug,
				),
			};
		case "milestone-selected":
			return { ...draft, milestone: action.milestone };
	}
}

function firstLine(message: string) {
	const subject = message.split("\n")[0]?.trim();
	return subject ? subject : null;
}

function titleFromBranchName(branch: string) {
	const words = branch.replace(/[-_]+/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function suggestPullRequestTitle(
	commits: readonly { message: string }[],
	head: string,
) {
	const onlyCommit = commits.length === 1 ? commits[0] : null;
	const subject = onlyCommit ? firstLine(onlyCommit.message) : null;
	return subject ?? titleFromBranchName(splitCompareRef(head).branch);
}

export function pullRequestTitle(draft: PullRequestDraft, suggestion: string) {
	return draft.editedTitle ?? suggestion;
}

export function pullRequestBody(draft: PullRequestDraft, template: string) {
	return draft.editedBody ?? template;
}

export type PermissionLookup =
	| { status: "pending" }
	| { status: "failed" }
	| { status: "known"; canPush: boolean };

/** The permission read answers `permission: null` instead of throwing when GitHub fails it. */
export function permissionLookup(query: {
	isError: boolean;
	data: RepoViewerPermission | undefined;
}): PermissionLookup {
	if (query.data?.permission) {
		return { status: "known", canPush: query.data.canPush };
	}
	return query.isError || query.data
		? { status: "failed" }
		: { status: "pending" };
}

export type PullRequestAccess =
	| "checking"
	| "unavailable"
	| "allowed"
	| "read-only";

/** Readers can open a pull request only from their own fork's branch. */
export function pullRequestAccess({
	lookup,
	head,
	repoOwner,
}: {
	lookup: PermissionLookup;
	head: string;
	repoOwner: string;
}): PullRequestAccess {
	if (isForkRef(head, repoOwner)) return "allowed";
	switch (lookup.status) {
		case "pending":
			return "checking";
		case "failed":
			return "unavailable";
		case "known":
			return lookup.canPush ? "allowed" : "read-only";
	}
}

function nonEmpty<T>(list: T[]) {
	return list.length > 0 ? list : undefined;
}

export function buildCreatePullRequestInput({
	owner,
	repo,
	base,
	head,
	draft,
	titleSuggestion,
	bodyTemplate,
}: {
	owner: string;
	repo: string;
	base: string;
	head: string;
	draft: PullRequestDraft;
	titleSuggestion: string;
	bodyTemplate: string;
}): CreatePullRequestInput | null {
	const title = pullRequestTitle(draft, titleSuggestion).trim();
	if (title === "") return null;
	const body = pullRequestBody(draft, bodyTemplate).trim();
	return {
		owner,
		repo,
		base,
		head,
		title,
		body: body === "" ? undefined : body,
		draft: draft.isDraft,
		labels: nonEmpty(draft.labels.map((label) => label.name)),
		assignees: nonEmpty(draft.assignees.map((assignee) => assignee.login)),
		reviewers: nonEmpty(draft.reviewers.map((reviewer) => reviewer.login)),
		teamReviewers: nonEmpty(draft.teamReviewers.map((team) => team.slug)),
		milestone: draft.milestone?.number,
	};
}
