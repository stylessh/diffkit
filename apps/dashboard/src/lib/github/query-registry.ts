import { isFullCommitSha } from "../code-browsing/code-location";
import {
	type GitHubChangeEntity,
	type GitHubChangeEntityKind,
	type GitHubRepoEntity,
	normalizeRepoFullName,
	parseEntityKey,
} from "../github-change-entities";
import type { GitHubQueryScope } from "./query-keys";

/**
 * Which change-feed entity kinds affect each `githubQueryKeys` group. Every
 * group must be listed (enforced by github.query.test.ts); `"exempt"` groups
 * never refetch from the feed and rely on staleTime + focus refetch.
 */
export const githubQueryEntityCoverage: Record<
	string,
	readonly GitHubChangeEntityKind[] | "exempt"
> = {
	viewer: "exempt",
	"repos.list": ["repo"],
	"repos.hub": ["repo"],
	"search.commandPalette": "exempt",
	"pulls.mine": ["pull"],
	"pulls.user": ["pull"],
	"pulls.repo": ["pull"],
	"pulls.forRefs": ["pull"],
	"pulls.page": ["pull"],
	"pulls.detail": ["pull"],
	"pulls.fileSummaries": ["pull"],
	"pulls.comments": ["pull"],
	"pulls.status": ["pull", "checks"],
	"pulls.files": ["pull"],
	"pulls.reviewComments": ["pull"],
	"pulls.reviewThreads": ["pull"],
	collaborators: ["collaborators"],
	repoLabels: ["labels"],
	repoMilestones: ["milestones"],
	orgTeams: "exempt",
	commentPage: ["pull", "issue"],
	timelineEventPage: ["pull", "issue"],
	profile: "exempt",
	profileRepos: "exempt",
	contributions: "exempt",
	pinnedRepos: "exempt",
	activity: "exempt",
	"repo.overview": ["repo", "pull", "issue", "release"],
	"repo.branches": ["repo"],
	"repo.branchComparison": ["repo"],
	"repo.compareDetail": ["repo"],
	"repo.recentPushableBranch": ["repo"],
	"repo.template": ["repo"],
	"repo.tree": ["repo"],
	"repo.fileLastCommit": ["repo"],
	"repo.commit": ["checks"],
	"repo.refHeadCommit": ["repo"],
	"repo.treeEntryCommits": ["repo"],
	"repo.contributors": ["repo"],
	"repo.participation": ["repo"],
	"repo.discussions": ["discussions"],
	"code.gitTree": ["repo"],
	"code.blob": ["repo"],
	"code.blame": ["repo"],
	"code.search": "exempt",
	"issues.mine": ["issue"],
	"issues.user": ["issue"],
	"issues.repo": ["issue"],
	"issues.page": ["issue"],
	"issues.detail": ["issue"],
	"issues.comments": ["issue"],
	"notifications.list": ["pull", "issue"],
	"actions.runsList": ["run"],
	"actions.workflowRun": ["run"],
	"actions.workflowRunJobs": ["run"],
	"actions.workflowRunArtifacts": ["run"],
	"actions.workflowDefinition": "exempt",
	"actions.workflowJobLogs": ["run"],
	"actions.workflowRunLogsBundle": ["run"],
	"commits.list": ["repo"],
	"releases.repo": ["release"],
	"releases.list": ["release"],
	"releases.detail": ["release"],
	"releases.viewerPermission": "exempt",
	"refs.names": ["repo", "release"],
	"refs.branches": ["repo"],
	"refs.tags": ["repo", "release"],
	"refs.comparison": ["repo"],
	"refs.splat": ["repo"],
	"references.item": ["pull", "issue"],
	"references.commit": "exempt",
	"repoSettings.general": ["repo"],
	"repoSettings.rulesets": ["repo"],
	"repoSettings.protections": ["repo"],
	"repoSettings.access": ["collaborators"],
	"repoSettings.webhooks": ["settings"],
	"repoSettings.webhookDeliveries": ["settings"],
	"repoSettings.actionsSecrets": ["settings"],
	"repoSettings.actionsVariables": ["settings"],
	"orgSettings.general": ["org"],
	"orgSettings.role": ["org"],
	"orgSettings.members": ["org"],
	"orgSettings.teams": ["org"],
	"orgSettings.teamMembers": ["org"],
	"orgSettings.viewerOrgs": "exempt",
};

/**
 * User-wide aggregates whose payload lists items across many repos. A pull or
 * issue change only refetches them when the changed item is already in the
 * cached payload, so one PR event in a busy org doesn't become a GitHub search
 * per member. The exception is an item the viewer just created
 * (`change: "created"`), which no cached payload can contain yet.
 */
const AGGREGATE_PATHS = new Set([
	"pulls.mine",
	"pulls.user",
	"issues.mine",
	"issues.user",
	"repos.list",
	"repos.hub",
	"notifications.list",
]);

/** `githubQueryKeys` path of a query key, e.g. `pulls.page` or `viewer`. */
export function githubQueryPath(queryKey: readonly unknown[]): string | null {
	if (queryKey[0] !== "github") return null;
	const group = queryKey[2];
	if (typeof group !== "string") return null;
	const name = queryKey[3];
	if (group === "releases" && name === "repo") {
		const leaf = queryKey[5];
		return typeof leaf === "string" ? `releases.${leaf}` : "releases.repo";
	}
	if (
		typeof name === "string" &&
		`${group}.${name}` in githubQueryEntityCoverage
	) {
		return `${group}.${name}`;
	}
	return group;
}

function githubQueryInput(
	queryKey: readonly unknown[],
): Record<string, unknown> | null {
	for (let index = queryKey.length - 1; index >= 3; index--) {
		const part = queryKey[index];
		if (part && typeof part === "object" && !Array.isArray(part)) {
			return part as Record<string, unknown>;
		}
	}
	return null;
}

/** Lowercased `owner/repo` a query is scoped to, or `null` for user-wide ones. */
export function githubQueryRepo(queryKey: readonly unknown[]): string | null {
	const input = githubQueryInput(queryKey);
	if (
		input &&
		typeof input.owner === "string" &&
		typeof input.repo === "string"
	) {
		return normalizeRepoFullName(input.owner, input.repo);
	}
	return null;
}

/** Lowercased organization login an organization query is scoped to. */
function githubQueryOrg(queryKey: readonly unknown[]): string | null {
	const org = githubQueryInput(queryKey)?.org;
	return typeof org === "string" ? org.toLowerCase() : null;
}

function* itemsOf(data: unknown): Generator<Record<string, unknown>> {
	const lists = Array.isArray(data)
		? [data]
		: data && typeof data === "object"
			? Object.values(data).filter(Array.isArray)
			: [];
	for (const list of lists) {
		for (const item of list as unknown[]) {
			if (item && typeof item === "object") {
				yield item as Record<string, unknown>;
			}
		}
	}
	if (data && typeof data === "object" && "pages" in data) {
		const pages = (data as { pages?: unknown }).pages;
		if (Array.isArray(pages)) {
			for (const page of pages) yield* itemsOf(page);
		}
	}
}

function itemRepo(item: Record<string, unknown>): string | null {
	const repository = item.repository as
		| { owner?: unknown; name?: unknown; fullName?: unknown }
		| undefined;
	if (
		repository &&
		typeof repository.owner === "string" &&
		typeof repository.name === "string"
	) {
		return normalizeRepoFullName(repository.owner, repository.name);
	}
	if (typeof repository?.fullName === "string") {
		return repository.fullName.toLowerCase();
	}
	if (typeof item.fullName === "string") return item.fullName.toLowerCase();
	return null;
}

const SUBJECT_NUMBER = /\/(?:pulls|issues)\/(\d+)$/;

/** Notifications only carry the item number inside their API subject URL. */
function itemNumber(item: Record<string, unknown>): number | null {
	if (typeof item.number === "number") return item.number;
	const subject = item.subject as { url?: unknown } | undefined;
	const match =
		typeof subject?.url === "string" ? SUBJECT_NUMBER.exec(subject.url) : null;
	return match ? Number(match[1]) : null;
}

function aggregateContains(data: unknown, entity: GitHubRepoEntity) {
	for (const item of itemsOf(data)) {
		if (itemRepo(item) !== entity.repo) continue;
		if (entity.kind === "pull" || entity.kind === "issue") {
			if (itemNumber(item) === entity.number) return true;
		} else {
			return true;
		}
	}
	return false;
}

/**
 * Whether a cached query is affected by a change-feed entity. `data` is the
 * query's cached payload, used for user-wide aggregates.
 */
export type GitHubEntityChange = "updated" | "created";

export function githubQueryMatchesEntity(
	queryKey: readonly unknown[],
	entity: GitHubChangeEntity,
	data?: unknown,
	change: GitHubEntityChange = "updated",
): boolean {
	const path = githubQueryPath(queryKey);
	if (!path) return false;
	const kinds = githubQueryEntityCoverage[path];
	if (!kinds || kinds === "exempt" || !kinds.includes(entity.kind)) {
		return false;
	}

	if (entity.kind === "org") return githubQueryOrg(queryKey) === entity.org;

	const repo = githubQueryRepo(queryKey);
	if (AGGREGATE_PATHS.has(path) && (repo === null || repo === entity.repo)) {
		return change === "created" || aggregateContains(data, entity);
	}
	if (repo !== entity.repo) return false;

	const input = githubQueryInput(queryKey) ?? {};
	switch (entity.kind) {
		case "pull":
			return input.pullNumber !== undefined
				? input.pullNumber === entity.number
				: input.issueNumber !== undefined
					? input.issueNumber === entity.number
					: true;
		case "issue":
			return input.issueNumber !== undefined
				? input.issueNumber === entity.number
				: true;
		case "run":
			return input.runId !== undefined ? input.runId === entity.runId : true;
		case "checks":
			return typeof input.sha === "string"
				? input.sha.toLowerCase().startsWith(entity.sha) ||
						entity.sha.startsWith(input.sha.toLowerCase())
				: true;
		case "repo":
			// Content read at a full commit SHA can never change.
			return !isFullCommitSha(input.ref);
		default:
			return true;
	}
}

export function queryFiltersForEntity(
	entity: GitHubChangeEntity | string,
	scope: GitHubQueryScope,
) {
	const parsed = typeof entity === "string" ? parseEntityKey(entity) : entity;
	return {
		queryKey: ["github", scope.userId] as const,
		predicate: (query: {
			queryKey: readonly unknown[];
			state: { data?: unknown };
		}) =>
			parsed !== null &&
			githubQueryMatchesEntity(query.queryKey, parsed, query.state.data),
	};
}
