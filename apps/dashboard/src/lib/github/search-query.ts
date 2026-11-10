import type { GitHubInstallationTargetType } from "../github-access";
import type { IssueSearchRole, PullSearchRole, RepoState } from "./shared";

export type GitHubSearchOwnerScope = {
	login: string;
	targetType: GitHubInstallationTargetType;
};

export function buildUserSearchQuery({
	itemType,
	role,
	state,
	username,
	owner,
	ownerType,
	repo,
	excludeOwners,
}: {
	itemType: "issue" | "pr";
	role: IssueSearchRole | PullSearchRole;
	state: RepoState;
	username: string;
	owner?: string;
	ownerType?: GitHubInstallationTargetType;
	repo?: string;
	excludeOwners?: GitHubSearchOwnerScope[];
}) {
	const stateFilter = state === "all" ? "" : ` is:${state}`;
	const scopeFilter =
		owner && repo
			? ` repo:${owner}/${repo}`
			: owner
				? ` ${buildOwnerSearchQualifier({ login: owner, targetType: ownerType })}`
				: "";
	const roleFilter =
		role === "all"
			? ` involves:${username}`
			: role === "assigned"
				? ` assignee:${username}`
				: role === "mentioned"
					? ` mentions:${username}`
					: role === "review-requested"
						? ` user-review-requested:${username}`
						: role === "involved"
							? ` involves:${username}`
							: ` author:${username}`;
	const exclusionFilter =
		excludeOwners
			?.map((scope) => ` -${buildOwnerSearchQualifier(scope)}`)
			.join("") ?? "";

	return `is:${itemType}${stateFilter}${scopeFilter}${roleFilter}${exclusionFilter} archived:false`;
}

function buildOwnerSearchQualifier(scope: {
	login: string;
	targetType?: GitHubInstallationTargetType;
}) {
	const qualifier = scope.targetType === "Organization" ? "org" : "user";
	return `${qualifier}:${scope.login}`;
}
