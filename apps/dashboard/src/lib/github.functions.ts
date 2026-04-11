import { createServerFn } from "@tanstack/react-start";
import { type Octokit as OctokitType, RequestError } from "octokit";
import type {
	CommandPaletteSearchResult,
	CreateLabelInput,
	CreateReviewCommentInput,
	GitHubAccountSummary,
	GitHubActor,
	GitHubLabel,
	IssueComment,
	IssueDetail,
	IssuePageData,
	IssueSummary,
	MyIssuesResult,
	MyPullsResult,
	OrgTeam,
	PullComment,
	PullCommit,
	PullDetail,
	PullFile,
	PullFileSummary,
	PullFilesPage,
	PullFilesPageInput,
	PullPageData,
	PullReviewComment,
	PullStatus,
	PullSummary,
	RepoCollaborator,
	RepositoryRef,
	RequestReviewersInput,
	SetLabelsInput,
	SubmitReviewInput,
	TimelineEvent,
	UserRepoSummary,
} from "./github.types";
import {
	buildGitHubAppAuthorizePath,
	buildGitHubAppInstallUrl,
	type GitHubAppAccessState,
	type GitHubAppInstallation,
	type GitHubInstallationTargetType,
	type GitHubOrganization,
} from "./github-access";
import { getGitHubAppSlug } from "./github-app.server";
import {
	bumpGitHubCacheNamespaces,
	bustGitHubCache,
	createGitHubResponseMetadata,
	type GitHubConditionalHeaders,
	type GitHubFetchResult,
	getGitHubRevalidationSignals,
	getOrRevalidateGitHubResource,
} from "./github-cache";
import { githubCachePolicy } from "./github-cache-policy";
import {
	type GitHubRevalidationSignalInput,
	githubRevalidationSignalKeys,
} from "./github-revalidation";

type GitHubClient = OctokitType;
type AuthSession = {
	user: {
		id: string;
	};
};
type GitHubContext = {
	session: AuthSession;
	octokit: GitHubClient;
};

type GitHubRestResponse<TData> = {
	data: TData;
	headers: Record<string, unknown>;
	status: number;
};

type SearchItem = Awaited<
	ReturnType<GitHubClient["rest"]["search"]["issuesAndPullRequests"]>
>["data"]["items"][number];
type SearchResult = Awaited<
	ReturnType<GitHubClient["rest"]["search"]["issuesAndPullRequests"]>
>["data"];
type RepositorySearchItem = Awaited<
	ReturnType<GitHubClient["rest"]["search"]["repos"]>
>["data"]["items"][number];
type UserSearchItem = Awaited<
	ReturnType<GitHubClient["rest"]["search"]["users"]>
>["data"]["items"][number];
type AuthenticatedUserRepo = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["listForAuthenticatedUser"]>
>["data"][number];
type RepoPullDetail = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["get"]>
>["data"];
type RepoIssueDetail = Awaited<
	ReturnType<GitHubClient["rest"]["issues"]["get"]>
>["data"];
type AuthenticatedUser = Awaited<
	ReturnType<GitHubClient["rest"]["users"]["getAuthenticated"]>
>["data"];
type RepoPullFile = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["listFiles"]>
>["data"][number];
type RepoPullReviewComment = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["listReviewComments"]>
>["data"][number];
type RepositoryPermissions = {
	admin?: boolean;
	maintain?: boolean;
	push?: boolean;
	triage?: boolean;
	pull?: boolean;
};
type GitHubBranchRule = {
	ruleset_id?: number;
};
type GitHubRepositoryRuleset = {
	current_user_can_bypass?:
		| "always"
		| "pull_requests_only"
		| "never"
		| "exempt";
};
type GitHubBranchProtection = {
	enforce_admins?: {
		enabled?: boolean;
	};
	required_pull_request_reviews?: {
		bypass_pull_request_allowances?: {
			users?: Array<{ login?: string }>;
			teams?: Array<{ slug?: string }>;
			apps?: Array<{ slug?: string }>;
		};
	};
};
type GitHubUserTeam = {
	slug?: string;
	organization?: {
		login?: string;
	};
};

type RepoState = "all" | "closed" | "open";
type PullSort = "created" | "long-running" | "popularity" | "updated";
type IssueSort = "comments" | "created" | "updated";

// ---------------------------------------------------------------------------
// Entity-scoped cache busting helpers
// ---------------------------------------------------------------------------
// Each helper busts all server-side D1 cache entries related to an entity so
// the next React Query refetch hits GitHub's API and returns fresh data.
// Add new resource keys here as new cached endpoints are introduced.
// ---------------------------------------------------------------------------

type PullCacheParams = { owner: string; repo: string; pullNumber: number };
type IssueCacheParams = { owner: string; repo: string; issueNumber: number };

async function bustPullDetailCaches(userId: string, params: PullCacheParams) {
	await Promise.all([
		bustGitHubCache(userId, "pulls.detail.raw", params),
		bustGitHubCache(userId, "pulls.status.raw", params),
		bustGitHubCache(userId, "pulls.status.v1", params),
		bustGitHubCache(userId, "pulls.status.v2", params),
		bustGitHubCache(userId, "pulls.status.v3", params),
	]);
}

async function bustPullReviewCaches(userId: string, params: PullCacheParams) {
	await bustGitHubCache(userId, "pulls.reviewComments", params);
}

async function bustIssueCaches(userId: string, params: IssueCacheParams) {
	await bustGitHubCache(userId, "issues.detail", params);
}

type GitHubApiUser = {
	login?: string;
	avatar_url?: string;
	html_url?: string;
	type?: string;
};

type GitHubApiLabel = {
	name?: string | null;
	color?: string | null;
	description?: string | null;
};

type GitHubInstallationAccountPayload = {
	id?: number;
	login?: string;
	avatar_url?: string | null;
	type?: string;
};

type GitHubReviewerBotInstallationPayload = {
	id?: number;
	account?: GitHubInstallationAccountPayload | null;
	repository_selection?: string;
	target_type?: string;
	permissions?: Record<string, string | undefined>;
	app_slug?: string;
	suspended_at?: string | null;
};

type GitHubUserInstallationPayload = {
	id?: number;
	account?: GitHubInstallationAccountPayload | null;
	html_url?: string | null;
	target_type?: string;
	repository_selection?: string;
	suspended_at?: string | null;
	permissions?: Record<string, string | undefined>;
	app_slug?: string;
};

type GitHubUserInstallationsPayload = {
	installations?: GitHubUserInstallationPayload[];
};

type GitHubInstallationRepositoriesPayload = {
	repositories?: Array<{
		name?: string;
		full_name?: string;
		owner?: {
			login?: string;
		} | null;
	}>;
};

function normalizeLogin(login: string) {
	return login.toLowerCase();
}

const KNOWN_REVIEWER_BOTS = [
	{
		appSlug: "copilot-pull-request-reviewer",
		botLogin: "copilot-pull-request-reviewer[bot]",
	},
	{ appSlug: "coderabbitai", botLogin: "coderabbitai[bot]" },
	{ appSlug: "cursor", botLogin: "cursor[bot]" },
	{ appSlug: "gemini-code-assist", botLogin: "gemini-code-assist[bot]" },
	{ appSlug: "claude", botLogin: "claude[bot]" },
	{ appSlug: "codegen-sh", botLogin: "codegen-sh[bot]" },
	{ appSlug: "qodo-merge", botLogin: "qodo-merge[bot]" },
] as const;

type KnownReviewerBot = (typeof KNOWN_REVIEWER_BOTS)[number];

const KNOWN_REVIEWER_BOTS_BY_APP_SLUG: ReadonlyMap<string, KnownReviewerBot> =
	new Map(KNOWN_REVIEWER_BOTS.map((bot) => [bot.appSlug, bot]));
const KNOWN_REVIEWER_BOT_LOGINS = new Set(
	KNOWN_REVIEWER_BOTS.map((bot) => normalizeLogin(bot.botLogin)),
);

type GitHubAuthenticatedOrgPayload = {
	id?: number;
	login?: string;
	avatar_url?: string | null;
};

type PullSearchRole =
	| "all"
	| "assigned"
	| "author"
	| "involved"
	| "mentioned"
	| "review-requested";

type IssueSearchRole = "all" | "assigned" | "author" | "mentioned";

export type PullsFromUserInput = {
	username?: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	role?: PullSearchRole;
	owner?: string;
	repo?: string;
};

export type IssuesFromUserInput = {
	username?: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	role?: IssueSearchRole;
	owner?: string;
	repo?: string;
};

export type PullsFromRepoInput = {
	owner: string;
	repo: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	sort?: PullSort;
	direction?: "asc" | "desc";
};

export type MutationResult =
	| { ok: true }
	| { ok: false; error: string; installUrl?: string };

function toMutationError(action: string, error: unknown): MutationResult {
	console.error(`[${action}]`, error);
	if (error instanceof RequestError) {
		if (error.status === 403) {
			return {
				ok: false,
				error: `Failed to ${action}: Insufficient permissions`,
				installUrl: buildGitHubAppInstallUrl(getGitHubAppSlug()) ?? undefined,
			};
		}
		if (error.status === 404) {
			return { ok: false, error: `Failed to ${action}: Resource not found` };
		}
		if (error.status === 422) {
			return { ok: false, error: `Failed to ${action}: Validation failed` };
		}
		if (error.status === 409) {
			return {
				ok: false,
				error: `Failed to ${action}: Conflict — head branch may have been modified`,
			};
		}
		const msg =
			(error.response?.data as { message?: string } | undefined)?.message ??
			error.message;
		return { ok: false, error: `Failed to ${action}: ${msg}` };
	}
	return { ok: false, error: `Failed to ${action}: Unknown error` };
}

export type PullFromRepoInput = {
	owner: string;
	repo: string;
	pullNumber: number;
};

export type IssuesFromRepoInput = {
	owner: string;
	repo: string;
	state?: RepoState;
	page?: number;
	perPage?: number;
	sort?: IssueSort;
	direction?: "asc" | "desc";
};

export type IssueFromRepoInput = {
	owner: string;
	repo: string;
	issueNumber: number;
};

export type CommandPaletteSearchInput = {
	query: string;
	perPage?: number;
};

const myPullRoleDefinitions = [
	{ key: "reviewRequested", role: "review-requested" },
	{ key: "assigned", role: "assigned" },
	{ key: "authored", role: "author" },
	{ key: "mentioned", role: "mentioned" },
	{ key: "involved", role: "involved" },
] as const satisfies Array<{
	key: keyof MyPullsResult;
	role: PullSearchRole;
}>;

const myIssueRoleDefinitions = [
	{ key: "assigned", role: "assigned" },
	{ key: "authored", role: "author" },
	{ key: "mentioned", role: "mentioned" },
] as const satisfies Array<{
	key: keyof MyIssuesResult;
	role: IssueSearchRole;
}>;

function clampPerPage(value: number | undefined, fallback = 30) {
	if (!Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(Math.max(Math.trunc(value ?? fallback), 1), 100);
}

function clampPage(value: number | undefined) {
	if (!Number.isFinite(value)) {
		return 1;
	}

	return Math.max(Math.trunc(value ?? 1), 1);
}

function clampCommandSearchPerPage(value: number | undefined) {
	return Math.min(clampPerPage(value, 5), 10);
}

function normalizeCommandPaletteSearchQuery(query: string) {
	return query.trim().replace(/\s+/g, " ").slice(0, 120);
}

function emptyCommandPaletteSearchResult(): CommandPaletteSearchResult {
	return {
		repositories: [],
		users: [],
		pulls: [],
		issues: [],
	};
}

function buildRepositoryRef(
	owner: string,
	repo: string,
	url?: string | null,
): RepositoryRef {
	return {
		name: repo,
		owner,
		fullName: `${owner}/${repo}`,
		url: url ?? `https://github.com/${owner}/${repo}`,
	};
}

function parseRepositoryRef(
	repositoryUrl?: string | null,
): RepositoryRef | null {
	if (!repositoryUrl) {
		return null;
	}

	const match = repositoryUrl.match(/repos\/([^/]+)\/([^/]+)$/);
	if (!match) {
		return null;
	}

	return buildRepositoryRef(
		match[1],
		match[2],
		`https://github.com/${match[1]}/${match[2]}`,
	);
}

function mapActor(user: GitHubApiUser | null | undefined): GitHubActor | null {
	if (!user?.login) {
		return null;
	}

	return {
		login: user.login,
		avatarUrl: user.avatar_url ?? "",
		url: user.html_url ?? `https://github.com/${user.login}`,
		type: user.type ?? "User",
	};
}

function mapGitHubAccountSearchItem(
	user: UserSearchItem,
): GitHubAccountSummary | null {
	if (!user.login) {
		return null;
	}

	return {
		id: user.id,
		login: user.login,
		avatarUrl: user.avatar_url ?? "",
		url: user.html_url ?? `https://github.com/${user.login}`,
		type: user.type ?? "User",
	};
}

function mapRepositorySearchItem(repo: RepositorySearchItem): UserRepoSummary {
	const ownerLogin = repo.owner?.login ?? "";
	const fullName =
		repo.full_name ?? [ownerLogin, repo.name].filter(Boolean).join("/");
	const fallbackOwner = fullName.split("/")[0] ?? "";

	return {
		id: repo.id,
		name: repo.name,
		fullName,
		description: repo.description ?? null,
		stars: repo.stargazers_count ?? 0,
		language: repo.language ?? null,
		updatedAt: repo.updated_at ?? null,
		isPrivate: repo.private ?? false,
		url: repo.html_url ?? `https://github.com/${fullName}`,
		owner: ownerLogin || fallbackOwner,
	};
}

function mapReviewerCandidate(user: GitHubApiUser): RepoCollaborator | null {
	const actor = mapActor(user);
	if (!actor) {
		return null;
	}

	return {
		login: actor.login,
		avatarUrl: actor.avatarUrl,
		url: actor.url,
		type: actor.type,
		permissions: {
			admin: false,
			push: false,
			pull: true,
		},
	};
}

function mergeReviewerCandidates(
	collaborators: RepoCollaborator[],
	bots: RepoCollaborator[],
) {
	const byLogin = new Map<string, RepoCollaborator>();

	for (const candidate of [...collaborators, ...bots]) {
		byLogin.set(candidate.login.toLowerCase(), candidate);
	}

	return Array.from(byLogin.values()).sort((left, right) =>
		left.login.localeCompare(right.login, undefined, { sensitivity: "base" }),
	);
}

function isKnownReviewerBotLogin(login: string) {
	return KNOWN_REVIEWER_BOT_LOGINS.has(normalizeLogin(login));
}

function isOwnGitHubAppBot(login: string) {
	const appSlug = getGitHubAppSlug();
	return appSlug !== null && normalizeLogin(login) === `${appSlug}[bot]`;
}

function isReviewerCandidate(candidate: RepoCollaborator) {
	return candidate.type !== "Bot" || isKnownReviewerBotLogin(candidate.login);
}

function mapLabel(
	label: string | GitHubApiLabel | null | undefined,
): GitHubLabel | null {
	if (!label || typeof label === "string" || !label.name) {
		return null;
	}

	return {
		name: label.name,
		color: label.color ?? "000000",
		description: label.description ?? null,
	};
}

function mapLabels(labels: Array<string | GitHubApiLabel> | null | undefined) {
	return (labels ?? [])
		.map((label) => mapLabel(label))
		.filter((label): label is GitHubLabel => Boolean(label));
}

function mapPullSummary(
	pull: {
		id: number;
		number: number;
		title: string;
		state: string;
		draft?: boolean | null;
		created_at: string;
		updated_at: string;
		closed_at: string | null;
		merged_at?: string | null;
		html_url: string;
		comments?: number;
		user?: GitHubApiUser | null;
		labels?: Array<string | GitHubApiLabel> | null;
	},
	repository: RepositoryRef,
): PullSummary {
	return {
		id: pull.id,
		number: pull.number,
		title: pull.title,
		state: pull.state,
		isDraft: "draft" in pull ? Boolean(pull.draft) : false,
		createdAt: pull.created_at,
		updatedAt: pull.updated_at,
		closedAt: pull.closed_at ?? null,
		mergedAt:
			"merged_at" in pull && typeof pull.merged_at === "string"
				? pull.merged_at
				: null,
		comments: pull.comments ?? 0,
		url: pull.html_url,
		author: mapActor(pull.user),
		labels: mapLabels(pull.labels),
		repository,
	};
}

function mapPullDetail(
	pull: RepoPullDetail,
	repository: RepositoryRef,
): PullDetail {
	return {
		...mapPullSummary(pull, repository),
		body: pull.body ?? "",
		additions: pull.additions,
		deletions: pull.deletions,
		changedFiles: pull.changed_files,
		commits: pull.commits,
		reviewComments: pull.review_comments,
		headRefName: pull.head.ref,
		headSha: pull.head.sha,
		baseRefName: pull.base.ref,
		isMerged: pull.merged,
		mergeCommitSha: pull.merge_commit_sha ?? null,
		mergedBy: pull.merged_by ? mapActor(pull.merged_by) : null,
		mergeable: pull.mergeable,
		mergeableState:
			typeof pull.mergeable_state === "string" ? pull.mergeable_state : null,
		requestedReviewers: (pull.requested_reviewers ?? [])
			.map((reviewer) => mapActor(reviewer))
			.filter((reviewer): reviewer is GitHubActor => Boolean(reviewer)),
		requestedTeams: (pull.requested_teams ?? []).map((team) => ({
			slug: team.slug,
			name: team.name,
			url: team.html_url,
		})),
	};
}

function mapIssueSummary(
	issue: {
		id: number;
		number: number;
		title: string;
		state: string;
		state_reason?: string | null;
		created_at: string;
		updated_at: string;
		closed_at: string | null;
		comments: number;
		html_url: string;
		user?: GitHubApiUser | null;
		labels?: Array<string | GitHubApiLabel> | null;
	},
	repository: RepositoryRef,
): IssueSummary {
	return {
		id: issue.id,
		number: issue.number,
		title: issue.title,
		state: issue.state,
		stateReason:
			"state_reason" in issue && typeof issue.state_reason === "string"
				? issue.state_reason
				: null,
		createdAt: issue.created_at,
		updatedAt: issue.updated_at,
		closedAt: issue.closed_at ?? null,
		comments: issue.comments,
		url: issue.html_url,
		author: mapActor(issue.user),
		labels: mapLabels(issue.labels),
		repository,
	};
}

function mapIssueDetail(
	issue: RepoIssueDetail,
	repository: RepositoryRef,
): IssueDetail {
	return {
		...mapIssueSummary(issue, repository),
		body: issue.body ?? "",
		assignees: (issue.assignees ?? [])
			.map((assignee) => mapActor(assignee))
			.filter((assignee): assignee is GitHubActor => Boolean(assignee)),
		milestone: issue.milestone
			? {
					title: issue.milestone.title,
					description: issue.milestone.description ?? null,
					dueOn: issue.milestone.due_on ?? null,
				}
			: null,
	};
}

function mapPullSearchItems(items: SearchItem[]) {
	return items
		.map((item) => {
			const repository = parseRepositoryRef(item.repository_url);
			if (!repository) {
				return null;
			}

			return mapPullSummary(
				{
					...item,
					merged_at: item.pull_request?.merged_at ?? null,
				},
				repository,
			);
		})
		.filter((item): item is PullSummary => Boolean(item));
}

function mapIssueSearchItems(items: SearchItem[]) {
	return items
		.map((item) => {
			const repository = parseRepositoryRef(item.repository_url);
			if (!repository) {
				return null;
			}

			return mapIssueSummary(item, repository);
		})
		.filter((item): item is IssueSummary => Boolean(item));
}

async function safeCommandPaletteSearch<T>({
	fallback,
	label,
	task,
}: {
	fallback: T;
	label: string;
	task: () => Promise<T>;
}) {
	try {
		return await task();
	} catch (error) {
		console.error(`[github-command-search] failed to search ${label}`, error);
		return fallback;
	}
}

async function getGitHubContext(): Promise<GitHubContext | null> {
	const { getGitHubClientByUserId, getRequestSession } = await import(
		"./auth-runtime"
	);
	const session = await getRequestSession();
	if (!session) {
		return null;
	}

	return {
		session,
		octokit: await getGitHubClientByUserId(session.user.id),
	};
}

function toRepositorySelection(value: string | undefined) {
	return value === "all" || value === "selected" ? value : "unknown";
}

function mapGitHubAppInstallations(
	payload: GitHubUserInstallationsPayload,
): GitHubAppInstallation[] {
	return (payload.installations ?? []).flatMap((installation) => {
		if (!installation.id || !installation.account?.login) {
			return [];
		}

		const targetType = toInstallationTargetType(installation.target_type);

		return [
			{
				id: installation.id,
				account: {
					id: installation.account.id ?? null,
					login: installation.account.login,
					name: null,
					avatarUrl: installation.account.avatar_url ?? null,
					type: toInstallationTargetType(installation.account.type),
				},
				targetType,
				repositorySelection: toRepositorySelection(
					installation.repository_selection,
				),
				manageUrl: installation.html_url ?? null,
				suspendedAt: installation.suspended_at ?? null,
			},
		];
	});
}

async function getGitHubAppUserInstallations(userId: string): Promise<{
	installations: GitHubAppInstallation[];
	installationsAvailable: boolean;
}> {
	const { getGitHubAppUserClientByUserId } = await import("./auth-runtime");
	const appUserOctokit = await getGitHubAppUserClientByUserId(userId);
	if (!appUserOctokit) {
		return { installations: [], installationsAvailable: false };
	}

	try {
		const installationsResponse = await appUserOctokit.request(
			"GET /user/installations",
			{
				per_page: 100,
			},
		);
		return {
			installations: mapGitHubAppInstallations(
				installationsResponse.data as GitHubUserInstallationsPayload,
			),
			installationsAvailable: true,
		};
	} catch (error) {
		console.error("[github-access] failed to load app installations", error);
		return { installations: [], installationsAvailable: false };
	}
}

async function getGitHubContextForOwner(owner: string) {
	const context = await getGitHubContext();
	if (!context) {
		return null;
	}

	const { installations } = await getGitHubAppUserInstallations(
		context.session.user.id,
	);
	const installation = findGitHubAppInstallationForOwner(installations, owner);
	if (!installation) {
		return context;
	}

	try {
		const { getGitHubInstallationClient } = await import("./github.server");
		return {
			...context,
			octokit: await getGitHubInstallationClient(installation.id),
		};
	} catch (error) {
		console.error(
			"[github-access] failed to create installation client",
			error,
		);
		return context;
	}
}

async function getGitHubContextForRepository(input: {
	owner: string;
	repo: string;
}) {
	return getGitHubContextForOwner(input.owner);
}

function findGitHubAppInstallationForOwner(
	installations: GitHubAppInstallation[],
	owner: string,
) {
	const normalizedOwner = owner.toLowerCase();
	return installations.find(
		(candidate) =>
			candidate.account.login.toLowerCase() === normalizedOwner ||
			(candidate.targetType === "User" &&
				candidate.account.login.toLowerCase() === normalizedOwner),
	);
}

async function getGitHubUserContextForOwner(owner: string) {
	const context = await getGitHubContext();
	if (!context) {
		return null;
	}

	const { getGitHubAppUserClientByUserId } = await import("./auth-runtime");
	const appUserOctokit = await getGitHubAppUserClientByUserId(
		context.session.user.id,
	);
	if (!appUserOctokit) {
		return context;
	}

	const { installations } = await getGitHubAppUserInstallations(
		context.session.user.id,
	);
	const installation = findGitHubAppInstallationForOwner(installations, owner);
	if (!installation) {
		return context;
	}

	return {
		...context,
		octokit: appUserOctokit,
	};
}

async function getGitHubUserContextForRepository(input: {
	owner: string;
	repo: string;
}) {
	return getGitHubUserContextForOwner(input.owner);
}

function isBypassableRulesetMode(
	mode: GitHubRepositoryRuleset["current_user_can_bypass"] | undefined,
) {
	return (
		mode === "always" || mode === "pull_requests_only" || mode === "exempt"
	);
}

function mergeRepositoryPermissions(
	...permissionsList: Array<RepositoryPermissions | null | undefined>
): RepositoryPermissions | undefined {
	const permissions = permissionsList.filter(
		(candidate): candidate is RepositoryPermissions => Boolean(candidate),
	);
	if (permissions.length === 0) {
		return undefined;
	}

	return {
		admin: permissions.some((permission) => permission.admin === true),
		maintain: permissions.some((permission) => permission.maintain === true),
		push: permissions.some((permission) => permission.push === true),
		triage: permissions.some((permission) => permission.triage === true),
		pull: permissions.some((permission) => permission.pull === true),
	};
}

async function getRepositoryPermissions(
	context: GitHubContext | null,
	owner: string,
	repo: string,
) {
	if (!context) {
		return null;
	}

	const response = await context.octokit.rest.repos
		.get({ owner, repo })
		.catch(() => null);
	return response?.data.permissions ?? null;
}

async function getRulesetPullRequestBypassState({
	branch,
	context,
	owner,
	repo,
}: {
	branch: string;
	context: GitHubContext;
	owner: string;
	repo: string;
}) {
	try {
		const rulesResponse = await context.octokit.request(
			"GET /repos/{owner}/{repo}/rules/branches/{branch}",
			{
				owner,
				repo,
				branch,
				per_page: 100,
			},
		);
		const rules = rulesResponse.data as GitHubBranchRule[];
		const rulesetIds = Array.from(
			new Set(
				rules
					.map((rule) => rule.ruleset_id)
					.filter((id): id is number => typeof id === "number"),
			),
		);

		if (rulesetIds.length === 0) {
			return null;
		}

		const rulesets = await Promise.all(
			rulesetIds.map(async (rulesetId) => {
				const response = await context.octokit.request(
					"GET /repos/{owner}/{repo}/rulesets/{ruleset_id}",
					{
						owner,
						repo,
						ruleset_id: rulesetId,
						includes_parents: true,
					},
				);
				return response.data as GitHubRepositoryRuleset;
			}),
		);

		if (
			rulesets.some((ruleset) => ruleset.current_user_can_bypass === "never")
		) {
			return false;
		}

		if (
			rulesets.every((ruleset) =>
				isBypassableRulesetMode(ruleset.current_user_can_bypass),
			)
		) {
			return true;
		}

		return null;
	} catch {
		return null;
	}
}

function loginMatches(left: string | undefined, right: string) {
	return left?.toLowerCase() === right.toLowerCase();
}

async function getAuthenticatedUserTeamSlugsForOrg(
	context: GitHubContext,
	org: string,
) {
	const teamSlugs = new Set<string>();
	let page = 1;

	while (true) {
		const response = await context.octokit.request("GET /user/teams", {
			page,
			per_page: 100,
		});
		const teams = response.data as GitHubUserTeam[];
		for (const team of teams) {
			if (loginMatches(team.organization?.login, org) && team.slug) {
				teamSlugs.add(team.slug.toLowerCase());
			}
		}

		if (teams.length < 100) {
			break;
		}

		page += 1;
	}

	return teamSlugs;
}

async function legacyBranchProtectionAllowsPullRequestBypass({
	branch,
	context,
	owner,
	permissions,
	repo,
	viewerLogin,
}: {
	branch: string;
	context: GitHubContext;
	owner: string;
	permissions: RepositoryPermissions | undefined;
	repo: string;
	viewerLogin: string;
}) {
	try {
		const response = await context.octokit.request(
			"GET /repos/{owner}/{repo}/branches/{branch}/protection",
			{
				owner,
				repo,
				branch,
			},
		);
		const protection = response.data as GitHubBranchProtection;
		const allowances =
			protection.required_pull_request_reviews?.bypass_pull_request_allowances;
		const allowedUsers = allowances?.users ?? [];
		if (allowedUsers.some((user) => loginMatches(user.login, viewerLogin))) {
			return true;
		}

		const allowedTeamSlugs = (allowances?.teams ?? []).flatMap((team) =>
			team.slug ? [team.slug.toLowerCase()] : [],
		);
		if (allowedTeamSlugs.length > 0) {
			const userTeamSlugs = await getAuthenticatedUserTeamSlugsForOrg(
				context,
				owner,
			);
			if (allowedTeamSlugs.some((slug) => userTeamSlugs.has(slug))) {
				return true;
			}
		}

		return (
			permissions?.admin === true && protection.enforce_admins?.enabled !== true
		);
	} catch {
		return null;
	}
}

async function getPullRequestBypassState({
	branch,
	context,
	fallbackContext,
	owner,
	permissions,
	repo,
}: {
	branch: string;
	context: GitHubContext;
	fallbackContext: GitHubContext | null;
	owner: string;
	permissions: RepositoryPermissions | undefined;
	repo: string;
}) {
	const contexts = [context, fallbackContext].filter(
		(candidate, index, candidates): candidate is GitHubContext =>
			Boolean(candidate) && candidates.indexOf(candidate) === index,
	);

	let rulesetState: boolean | null = null;
	for (const candidate of contexts) {
		const candidateRulesetState = await getRulesetPullRequestBypassState({
			branch,
			context: candidate,
			owner,
			repo,
		});
		if (candidateRulesetState === false) {
			rulesetState ??= false;
		}
		if (candidateRulesetState === true) {
			rulesetState = true;
		}
	}

	let legacyState: boolean | null = null;
	for (const candidate of contexts) {
		try {
			const viewerResponse =
				await candidate.octokit.rest.users.getAuthenticated();
			const candidateLegacyState =
				await legacyBranchProtectionAllowsPullRequestBypass({
					branch,
					context: candidate,
					owner,
					permissions,
					repo,
					viewerLogin: viewerResponse.data.login,
				});
			if (candidateLegacyState === false) {
				legacyState ??= false;
			}
			if (candidateLegacyState === true) {
				legacyState = true;
			}
		} catch {}
	}

	if (rulesetState === false || legacyState === false) {
		return false;
	}

	return (
		rulesetState === true || legacyState === true || permissions?.admin === true
	);
}

function buildUserSearchQuery({
	itemType,
	role,
	state,
	username,
	owner,
	repo,
}: {
	itemType: "issue" | "pr";
	role: IssueSearchRole | PullSearchRole;
	state: RepoState;
	username: string;
	owner?: string;
	repo?: string;
}) {
	const stateFilter = state === "all" ? "" : ` is:${state}`;
	const scopeFilter = owner && repo ? ` repo:${owner}/${repo}` : "";
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

	return `is:${itemType}${stateFilter}${scopeFilter}${roleFilter} archived:false`;
}

function buildConditionalHeaders(conditionals: GitHubConditionalHeaders) {
	const headers: Record<string, string> = {};

	if (conditionals.etag) {
		headers["if-none-match"] = conditionals.etag;
	}

	if (conditionals.lastModified) {
		headers["if-modified-since"] = conditionals.lastModified;
	}

	return headers;
}

function normalizeResponseHeaders(headers: Record<string, unknown>) {
	return Object.entries(headers).reduce<Record<string, string | null>>(
		(accumulator, [key, value]) => {
			if (typeof value === "string") {
				accumulator[key.toLowerCase()] = value;
			} else if (typeof value === "number") {
				accumulator[key.toLowerCase()] = String(value);
			} else if (Array.isArray(value) && typeof value[0] === "string") {
				accumulator[key.toLowerCase()] = value[0];
			}

			return accumulator;
		},
		{},
	);
}

async function executeGitHubRequest<TData>(
	request: (
		headers: Record<string, string>,
	) => Promise<GitHubRestResponse<TData>>,
	conditionals: GitHubConditionalHeaders,
): Promise<GitHubFetchResult<TData>> {
	try {
		const response = await request(buildConditionalHeaders(conditionals));

		return {
			kind: "success",
			data: response.data,
			metadata: createGitHubResponseMetadata(
				response.status,
				normalizeResponseHeaders(response.headers),
			),
		};
	} catch (error) {
		if (
			error instanceof RequestError &&
			error.status === 304 &&
			error.response?.headers
		) {
			return {
				kind: "not-modified",
				metadata: createGitHubResponseMetadata(
					304,
					normalizeResponseHeaders(
						error.response.headers as Record<string, unknown>,
					),
				),
			};
		}

		throw error;
	}
}

async function getCachedGitHubRequest<TGitHubData, TResult>({
	context,
	resource,
	params,
	freshForMs,
	signalKeys,
	namespaceKeys,
	cacheMode,
	request,
	mapData,
}: {
	context: GitHubContext;
	resource: string;
	params: unknown;
	freshForMs: number;
	signalKeys?: string[];
	namespaceKeys?: string[];
	cacheMode?: "legacy" | "split";
	request: (
		headers: Record<string, string>,
	) => Promise<GitHubRestResponse<TGitHubData>>;
	mapData: (data: TGitHubData) => TResult;
}) {
	return getOrRevalidateGitHubResource<TResult>({
		userId: context.session.user.id,
		resource,
		params,
		freshForMs,
		signalKeys,
		namespaceKeys,
		cacheMode,
		fetcher: async (conditionals) => {
			const result = await executeGitHubRequest(request, conditionals);

			if (result.kind === "not-modified") {
				return result;
			}

			return {
				...result,
				data: mapData(result.data),
			};
		},
	});
}

async function getCachedPaginatedGitHubRequest<TGitHubItem, TResult>({
	context,
	resource,
	params,
	freshForMs,
	signalKeys,
	namespaceKeys,
	cacheMode,
	request,
	mapData,
	pageSize = 100,
}: {
	context: GitHubContext;
	resource: string;
	params: unknown;
	freshForMs: number;
	signalKeys?: string[];
	namespaceKeys?: string[];
	cacheMode?: "legacy" | "split";
	request: (page: number) => Promise<GitHubRestResponse<TGitHubItem[]>>;
	mapData: (items: TGitHubItem[]) => TResult;
	pageSize?: number;
}) {
	return getOrRevalidateGitHubResource<TResult>({
		userId: context.session.user.id,
		resource,
		params,
		freshForMs,
		signalKeys,
		namespaceKeys,
		cacheMode,
		fetcher: async () => {
			const items: TGitHubItem[] = [];
			let page = 1;
			let metadata = createGitHubResponseMetadata(200, {});

			while (true) {
				const response = await request(page);
				if (page === 1) {
					metadata = createGitHubResponseMetadata(
						response.status,
						normalizeResponseHeaders(response.headers),
					);
				}

				items.push(...response.data);
				if (response.data.length < pageSize) {
					break;
				}

				page += 1;
			}

			return {
				kind: "success",
				data: mapData(items),
				metadata,
			};
		},
	});
}

async function listPaginatedGitHubItems<TItem>({
	request,
	getItems,
	pageSize = 100,
}: {
	request: (page: number) => Promise<GitHubRestResponse<unknown>>;
	getItems: (data: unknown) => TItem[];
	pageSize?: number;
}) {
	const items: TItem[] = [];
	let page = 1;

	while (true) {
		const response = await request(page);
		const pageItems = getItems(response.data);
		items.push(...pageItems);

		if (pageItems.length < pageSize) {
			break;
		}

		page += 1;
	}

	return items;
}

function installationBelongsToOwner(
	installation: GitHubReviewerBotInstallationPayload,
	owner: string,
) {
	return (
		installation.account?.login !== undefined &&
		normalizeLogin(installation.account.login) === normalizeLogin(owner)
	);
}

function installationCanReviewPullRequests(
	installation: GitHubReviewerBotInstallationPayload,
) {
	const pullRequestsPermission = installation.permissions?.pull_requests;

	return (
		!installation.suspended_at &&
		installation.app_slug !== undefined &&
		KNOWN_REVIEWER_BOTS_BY_APP_SLUG.has(installation.app_slug) &&
		(pullRequestsPermission === "write" || pullRequestsPermission === "admin")
	);
}

function getKnownReviewerBotForInstallation(
	installation: GitHubReviewerBotInstallationPayload,
): KnownReviewerBot | null {
	if (!installation.app_slug) {
		return null;
	}

	return KNOWN_REVIEWER_BOTS_BY_APP_SLUG.get(installation.app_slug) ?? null;
}

function repositoryMatchesInstallationRepository(
	repository: NonNullable<
		GitHubInstallationRepositoriesPayload["repositories"]
	>[number],
	params: RepoCollaboratorsInput,
) {
	const fullName = repository.full_name?.toLowerCase();
	if (fullName === `${params.owner}/${params.repo}`.toLowerCase()) {
		return true;
	}

	return (
		repository.owner?.login !== undefined &&
		repository.name !== undefined &&
		normalizeLogin(repository.owner.login) === normalizeLogin(params.owner) &&
		normalizeLogin(repository.name) === normalizeLogin(params.repo)
	);
}

async function installationHasRepositoryAccess(
	context: GitHubContext,
	installation: GitHubReviewerBotInstallationPayload,
	params: RepoCollaboratorsInput,
) {
	if (
		!installation.id ||
		!installationBelongsToOwner(installation, params.owner)
	) {
		return false;
	}

	if (installation.repository_selection === "all") {
		return true;
	}

	if (installation.repository_selection !== "selected") {
		return false;
	}

	try {
		const repositories = await listPaginatedGitHubItems({
			request: (page) =>
				context.octokit.rest.apps.listInstallationReposForAuthenticatedUser({
					installation_id: installation.id as number,
					page,
					per_page: 100,
				}),
			getItems: (payload) =>
				((payload as GitHubInstallationRepositoriesPayload).repositories ??
					[]) as NonNullable<
					GitHubInstallationRepositoriesPayload["repositories"]
				>,
		});

		return repositories.some((repository) =>
			repositoryMatchesInstallationRepository(repository, params),
		);
	} catch {
		return false;
	}
}

async function listReviewerBotInstallations(
	context: GitHubContext,
	params: RepoCollaboratorsInput,
) {
	const installations = new Map<number, GitHubReviewerBotInstallationPayload>();

	try {
		const orgInstallations = await listPaginatedGitHubItems({
			request: (page) =>
				context.octokit.rest.orgs.listAppInstallations({
					org: params.owner,
					page,
					per_page: 100,
				}),
			getItems: (payload) =>
				(
					(
						payload as {
							installations?: GitHubReviewerBotInstallationPayload[];
						}
					).installations ?? []
				).filter((installation) => typeof installation.id === "number"),
		});

		for (const installation of orgInstallations) {
			if (installation.id) {
				installations.set(installation.id, installation);
			}
		}
	} catch {
		// Not every user can list all org app installations. Fall back below to
		// installations the authenticated user can see.
	}

	try {
		const userInstallations = await listPaginatedGitHubItems({
			request: (page) =>
				context.octokit.rest.apps.listInstallationsForAuthenticatedUser({
					page,
					per_page: 100,
				}),
			getItems: (payload) =>
				(
					(
						payload as {
							installations?: GitHubReviewerBotInstallationPayload[];
						}
					).installations ?? []
				).filter((installation) => typeof installation.id === "number"),
		});

		for (const installation of userInstallations) {
			if (installation.id) {
				installations.set(installation.id, installation);
			}
		}
	} catch {
		// Reviewer bots are additive; missing this endpoint should not hide
		// normal people or teams from the picker.
	}

	return Array.from(installations.values());
}

async function mapReviewerBotInstallation(
	context: GitHubContext,
	installation: GitHubReviewerBotInstallationPayload,
) {
	const knownBot = getKnownReviewerBotForInstallation(installation);
	if (!knownBot) {
		return null;
	}

	try {
		const response = await context.octokit.rest.users.getByUsername({
			username: knownBot.botLogin,
		});

		const candidate = mapReviewerCandidate(response.data);
		return candidate?.type === "Bot" ? candidate : null;
	} catch {
		return null;
	}
}

async function getCachedRepoReviewerBots(
	context: GitHubContext,
	params: RepoCollaboratorsInput,
) {
	return getOrRevalidateGitHubResource<RepoCollaborator[]>({
		userId: context.session.user.id,
		resource: "repos.reviewerBots",
		params,
		freshForMs: githubCachePolicy.viewer.staleTimeMs,
		namespaceKeys: [
			githubRevalidationSignalKeys.repoCollaborators({
				owner: params.owner,
				repo: params.repo,
			}),
		],
		cacheMode: "split",
		fetcher: async () => {
			const installations = await listReviewerBotInstallations(context, params);
			const matchingInstallations: GitHubReviewerBotInstallationPayload[] = [];
			const ownAppSlug = getGitHubAppSlug();

			for (const installation of installations) {
				if (
					installation.app_slug !== ownAppSlug &&
					installationCanReviewPullRequests(installation) &&
					(await installationHasRepositoryAccess(context, installation, params))
				) {
					matchingInstallations.push(installation);
				}
			}

			const bots = (
				await Promise.all(
					matchingInstallations.map((installation) =>
						mapReviewerBotInstallation(context, installation),
					),
				)
			).filter((candidate): candidate is RepoCollaborator =>
				Boolean(candidate),
			);

			return {
				kind: "success",
				data: mergeReviewerCandidates([], bots),
				metadata: createGitHubResponseMetadata(200, {}),
			};
		},
	});
}

async function orgTeamHasRepoAccess(
	context: GitHubContext,
	params: OrgTeamsInput,
	team: OrgTeam,
) {
	try {
		await context.octokit.rest.teams.checkPermissionsForRepoInOrg({
			org: params.org,
			team_slug: team.slug,
			owner: params.owner,
			repo: params.repo,
		});

		return true;
	} catch {
		return false;
	}
}

async function getCachedPullResponse({
	context,
	data,
	resource,
	freshForMs,
}: {
	context: GitHubContext;
	data: PullFromRepoInput;
	resource: string;
	freshForMs: number;
}) {
	const pullNamespaceKey = githubRevalidationSignalKeys.pullEntity({
		owner: data.owner,
		repo: data.repo,
		pullNumber: data.pullNumber,
	});

	return getCachedGitHubRequest<RepoPullDetail, RepoPullDetail>({
		context,
		resource,
		params: data,
		freshForMs,
		signalKeys: [pullNamespaceKey],
		namespaceKeys: [pullNamespaceKey],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.pulls.get({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				headers,
			}),
		mapData: (pull) => pull,
	});
}

async function getPullDetailResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullDetail> {
	const pull = await getCachedPullResponse({
		context,
		data,
		resource: "pulls.detail.raw",
		freshForMs: githubCachePolicy.detail.staleTimeMs,
	});

	return mapPullDetail(pull, buildRepositoryRef(data.owner, data.repo));
}

async function getPullCommentsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullComment[]> {
	type IssueComment = Awaited<
		ReturnType<GitHubClient["rest"]["issues"]["listComments"]>
	>["data"][number];
	const pullNamespaceKey = githubRevalidationSignalKeys.pullEntity({
		owner: data.owner,
		repo: data.repo,
		pullNumber: data.pullNumber,
	});

	return getCachedGitHubRequest<IssueComment[], PullComment[]>({
		context,
		resource: "pulls.comments",
		params: data,
		freshForMs: githubCachePolicy.activity.staleTimeMs,
		signalKeys: [pullNamespaceKey],
		namespaceKeys: [pullNamespaceKey],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.issues.listComments({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.pullNumber,
				per_page: 10,
				headers,
			}),
		mapData: (comments) =>
			comments.map((comment) => ({
				id: comment.id,
				body: comment.body ?? "",
				createdAt: comment.created_at,
				author: comment.user
					? {
							login: comment.user.login,
							avatarUrl: comment.user.avatar_url,
							url: comment.user.html_url,
							type: comment.user.type ?? "User",
						}
					: null,
			})),
	});
}

async function getPullCommitsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullCommit[]> {
	type PullCommitResponse = Awaited<
		ReturnType<GitHubClient["rest"]["pulls"]["listCommits"]>
	>["data"][number];
	const pullNamespaceKey = githubRevalidationSignalKeys.pullEntity({
		owner: data.owner,
		repo: data.repo,
		pullNumber: data.pullNumber,
	});

	return getCachedGitHubRequest<PullCommitResponse[], PullCommit[]>({
		context,
		resource: "pulls.commits",
		params: data,
		freshForMs: githubCachePolicy.activity.staleTimeMs,
		signalKeys: [pullNamespaceKey],
		namespaceKeys: [pullNamespaceKey],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.pulls.listCommits({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				per_page: 100,
				headers,
			}),
		mapData: (commits) =>
			commits.map((c) => ({
				sha: c.sha,
				message: c.commit.message,
				createdAt: c.commit.author?.date ?? c.commit.committer?.date ?? "",
				author: c.author
					? {
							login: c.author.login,
							avatarUrl: c.author.avatar_url,
							url: c.author.html_url,
							type: c.author.type ?? "User",
						}
					: null,
			})),
	});
}

const COMMENTS_PER_PAGE = 30;

type CommentPageInput = {
	owner: string;
	repo: string;
	issueNumber: number;
	page: number;
};

async function getCommentsPageResult(
	context: GitHubContext,
	data: CommentPageInput,
): Promise<{
	comments: Array<{
		id: number;
		body: string;
		createdAt: string;
		author: GitHubActor | null;
	}>;
	total: number;
}> {
	const response = await context.octokit.rest.issues.listComments({
		owner: data.owner,
		repo: data.repo,
		issue_number: data.issueNumber,
		per_page: COMMENTS_PER_PAGE,
		page: data.page,
	});

	const linkHeader = response.headers.link ?? "";
	let total = response.data.length + (data.page - 1) * COMMENTS_PER_PAGE;
	const lastMatch = linkHeader.match(/[&?]page=(\d+)[^>]*>;\s*rel="last"/);
	if (lastMatch) {
		total = Number(lastMatch[1]) * COMMENTS_PER_PAGE;
	}

	return {
		comments: response.data.map((c) => ({
			id: c.id,
			body: c.body ?? "",
			createdAt: c.created_at,
			author: c.user
				? {
						login: c.user.login,
						avatarUrl: c.user.avatar_url,
						url: c.user.html_url,
						type: c.user.type ?? "User",
					}
				: null,
		})),
		total,
	};
}

const TIMELINE_EVENT_TYPES = new Set([
	"labeled",
	"unlabeled",
	"assigned",
	"unassigned",
	"review_requested",
	"review_request_removed",
	"renamed",
	"closed",
	"reopened",
	"milestoned",
	"demilestoned",
	"cross-referenced",
	"referenced",
	"reviewed",
	"convert_to_draft",
	"ready_for_review",
]);

function mapTimelineEvents(rawEvents: unknown[]): TimelineEvent[] {
	return rawEvents
		.filter((e) => {
			const event = (e as Record<string, unknown>).event as string | undefined;
			return event && TIMELINE_EVENT_TYPES.has(event);
		})
		.map((e) => {
			const raw = e as Record<string, unknown>;
			const actor = raw.actor as Record<string, unknown> | null | undefined;
			const label = raw.label as Record<string, unknown> | null | undefined;
			const assignee = raw.assignee as
				| Record<string, unknown>
				| null
				| undefined;
			const reviewer = raw.requested_reviewer as
				| Record<string, unknown>
				| null
				| undefined;
			const team = raw.requested_team as
				| Record<string, unknown>
				| null
				| undefined;
			const rename = raw.rename as Record<string, unknown> | null | undefined;
			const milestone = raw.milestone as
				| Record<string, unknown>
				| null
				| undefined;
			const source = raw.source as Record<string, unknown> | null | undefined;

			let mappedSource: TimelineEvent["source"] = null;
			if (source) {
				const issue = source.issue as Record<string, unknown> | undefined;
				if (issue) {
					const repo = issue.repository as Record<string, unknown> | undefined;
					mappedSource = {
						type: issue.pull_request ? "pull_request" : "issue",
						number: issue.number as number,
						title: (issue.title as string) ?? "",
						state: (issue.state as string) ?? "",
						url: (issue.html_url as string) ?? "",
						repository: (repo?.full_name as string) ?? null,
					};
				}
			}

			return {
				id: (raw.id as number) ?? 0,
				event: raw.event as string,
				createdAt: (raw.created_at as string) ?? "",
				actor: actor
					? {
							login: (actor.login as string) ?? "",
							avatarUrl: (actor.avatar_url as string) ?? "",
							url: (actor.html_url as string) ?? "",
							type: (actor.type as string) ?? "User",
						}
					: null,
				label: label
					? {
							name: (label.name as string) ?? "",
							color: (label.color as string) ?? "",
						}
					: undefined,
				assignee: assignee
					? {
							login: (assignee.login as string) ?? "",
							avatarUrl: (assignee.avatar_url as string) ?? "",
							url: (assignee.html_url as string) ?? "",
							type: (assignee.type as string) ?? "User",
						}
					: undefined,
				requestedReviewer: reviewer
					? {
							login: (reviewer.login as string) ?? "",
							avatarUrl: (reviewer.avatar_url as string) ?? "",
							url: (reviewer.html_url as string) ?? "",
							type: (reviewer.type as string) ?? "User",
						}
					: undefined,
				requestedTeam: team
					? {
							name: (team.name as string) ?? "",
							slug: (team.slug as string) ?? "",
						}
					: undefined,
				rename: rename
					? {
							from: (rename.from as string) ?? "",
							to: (rename.to as string) ?? "",
						}
					: undefined,
				milestone: milestone
					? { title: (milestone.title as string) ?? "" }
					: undefined,
				source: mappedSource,
				reviewState: (raw.state as string) ?? undefined,
				body: (raw.body as string) ?? undefined,
			};
		});
}

type GraphQLCrossRefResponse = {
	repository: {
		issueOrPullRequest: {
			timelineItems: {
				nodes: Array<{
					actor: { login: string; avatarUrl: string; url: string } | null;
					createdAt: string;
					source: {
						__typename: string;
						number: number;
						title: string;
						state: string;
						url: string;
						repository: { nameWithOwner: string };
					};
				}>;
			};
		} | null;
	};
};

async function getCrossReferencesViaGraphQL(
	context: GitHubContext,
	data: { owner: string; repo: string; issueNumber: number },
): Promise<TimelineEvent[]> {
	try {
		const response = await context.octokit.graphql<GraphQLCrossRefResponse>(
			`query ($owner: String!, $repo: String!, $number: Int!) {
				repository(owner: $owner, name: $repo) {
					issueOrPullRequest(number: $number) {
						... on Issue {
							timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
								nodes {
									... on CrossReferencedEvent {
										actor { login avatarUrl url }
										createdAt
										source {
											__typename
											... on Issue {
												number title state url
												repository { nameWithOwner }
											}
											... on PullRequest {
												number title state url
												repository { nameWithOwner }
											}
										}
									}
								}
							}
						}
						... on PullRequest {
							timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT]) {
								nodes {
									... on CrossReferencedEvent {
										actor { login avatarUrl url }
										createdAt
										source {
											__typename
											... on Issue {
												number title state url
												repository { nameWithOwner }
											}
											... on PullRequest {
												number title state url
												repository { nameWithOwner }
											}
										}
									}
								}
							}
						}
					}
				}
			}`,
			{
				owner: data.owner,
				repo: data.repo,
				number: data.issueNumber,
			},
		);

		const issueOrPR = response.repository.issueOrPullRequest;
		const nodes = issueOrPR?.timelineItems.nodes ?? [];

		return nodes
			.filter((node) => node.source)
			.map((node) => ({
				id: 0,
				event: "cross-referenced",
				createdAt: node.createdAt,
				actor: node.actor
					? {
							login: node.actor.login,
							avatarUrl: node.actor.avatarUrl,
							url: node.actor.url,
							type: "User",
						}
					: null,
				source: {
					type:
						node.source.__typename === "PullRequest"
							? ("pull_request" as const)
							: ("issue" as const),
					number: node.source.number,
					title: node.source.title,
					state: node.source.state.toLowerCase(),
					url: node.source.url,
					repository: node.source.repository.nameWithOwner,
				},
			}));
	} catch (error) {
		console.error(
			"[timeline:graphql] ERROR:",
			error instanceof Error ? error.message : error,
		);
		return [];
	}
}

const TIMELINE_EVENTS_PER_PAGE = 100;

type TimelineEventsResult = {
	events: TimelineEvent[];
	hasMore: boolean;
};

async function getTimelineEventsResult(
	context: GitHubContext,
	data: { owner: string; repo: string; issueNumber: number },
): Promise<TimelineEventsResult> {
	const [restResult, crossRefs] = await Promise.all([
		getRestTimelineEventsPage(context, data, 1),
		getCrossReferencesViaGraphQL(context, data),
	]);

	const restCrossRefKeys = new Set(
		restResult.events
			.filter((e) => e.event === "cross-referenced" && e.source)
			.map((e) => `${e.source?.repository ?? ""}#${e.source?.number}`),
	);

	const uniqueCrossRefs = crossRefs.filter(
		(e) =>
			!restCrossRefKeys.has(
				`${e.source?.repository ?? ""}#${e.source?.number}`,
			),
	);

	return {
		events: [...restResult.events, ...uniqueCrossRefs],
		hasMore: restResult.hasMore,
	};
}

async function getRestTimelineEventsPage(
	context: GitHubContext,
	data: { owner: string; repo: string; issueNumber: number },
	page: number,
): Promise<TimelineEventsResult> {
	try {
		const response = await context.octokit.request(
			"GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
			{
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				per_page: TIMELINE_EVENTS_PER_PAGE,
				page,
				headers: {
					accept: "application/vnd.github.v3+json",
				},
			},
		);

		const items = response.data as unknown[];

		return {
			events: mapTimelineEvents(items),
			hasMore: items.length >= TIMELINE_EVENTS_PER_PAGE,
		};
	} catch (error) {
		console.error(
			"[timeline:rest] ERROR:",
			error instanceof Error ? error.message : error,
		);
		return { events: [], hasMore: false };
	}
}

async function computePullStatus(
	context: GitHubContext,
	data: PullFromRepoInput,
	pull: RepoPullDetail,
): Promise<PullStatus> {
	const [reviewsResponse, checksResponse, userContext, oauthContext] =
		await Promise.all([
			context.octokit.rest.pulls.listReviews({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				per_page: 100,
			}),
			context.octokit.rest.checks
				.listForRef({
					owner: data.owner,
					repo: data.repo,
					ref: pull.head.sha,
					per_page: 100,
				})
				.catch(() => null),
			getGitHubUserContextForRepository(data),
			getGitHubContext(),
		]);
	const permissions = mergeRepositoryPermissions(
		await getRepositoryPermissions(
			userContext ?? context,
			data.owner,
			data.repo,
		),
		await getRepositoryPermissions(oauthContext, data.owner, data.repo),
		pull.base.repo.permissions,
	);

	const latestReviews = new Map<
		string,
		{ id: number; state: string; author: GitHubActor | null }
	>();
	for (const review of reviewsResponse.data) {
		if (!review.user?.login || review.state === "COMMENTED") {
			continue;
		}

		latestReviews.set(review.user.login, {
			id: review.id,
			state: review.state,
			author: mapActor(review.user),
		});
	}

	const checkRuns = checksResponse?.data.check_runs ?? [];
	let passed = 0;
	let failed = 0;
	let pending = 0;
	let skipped = 0;
	for (const check of checkRuns) {
		if (check.status !== "completed") {
			pending += 1;
		} else if (
			check.conclusion === "success" ||
			check.conclusion === "neutral"
		) {
			passed += 1;
		} else if (check.conclusion === "skipped") {
			skipped += 1;
		} else {
			failed += 1;
		}
	}

	let behindBy: number | null = null;
	try {
		const comparison = await context.octokit.rest.repos.compareCommits({
			owner: data.owner,
			repo: data.repo,
			base: pull.head.sha,
			head: pull.base.ref,
		});
		behindBy = comparison.data.ahead_by;
	} catch {
		behindBy = null;
	}

	const canUpdateBranch =
		!permissions || permissions.push === true || permissions.admin === true;
	const canBypassProtections = await getPullRequestBypassState({
		branch: pull.base.ref,
		context: userContext ?? context,
		fallbackContext: oauthContext,
		owner: data.owner,
		permissions,
		repo: data.repo,
	});

	return {
		reviews: Array.from(latestReviews.values()),
		checks: {
			total: checkRuns.length,
			passed,
			failed,
			pending,
			skipped,
		},
		checkRuns: checkRuns.map((check) => ({
			id: check.id,
			name: check.name,
			status: check.status,
			conclusion: check.conclusion,
			appAvatarUrl: check.app?.owner?.avatar_url ?? null,
			outputTitle: check.output?.title ?? null,
			startedAt: check.started_at ?? null,
		})),
		mergeable: pull.mergeable,
		mergeableState:
			typeof pull.mergeable_state === "string" ? pull.mergeable_state : null,
		behindBy,
		baseRefName: pull.base.ref,
		canUpdateBranch,
		canBypassProtections,
	};
}

async function getPullStatusResult(
	context: GitHubContext,
	data: PullFromRepoInput,
	pull?: RepoPullDetail,
): Promise<PullStatus> {
	const pullNamespaceKey = githubRevalidationSignalKeys.pullEntity({
		owner: data.owner,
		repo: data.repo,
		pullNumber: data.pullNumber,
	});

	return getOrRevalidateGitHubResource<PullStatus>({
		userId: context.session.user.id,
		resource: "pulls.status.v3",
		params: data,
		freshForMs: githubCachePolicy.status.staleTimeMs,
		signalKeys: [pullNamespaceKey],
		namespaceKeys: [pullNamespaceKey],
		cacheMode: "split",
		fetcher: async () => {
			const pullForStatus =
				pull ??
				(await getCachedPullResponse({
					context,
					data,
					resource: "pulls.status.raw",
					freshForMs: githubCachePolicy.status.staleTimeMs,
				}));

			return {
				kind: "success",
				data: await computePullStatus(context, data, pullForStatus),
				metadata: createGitHubResponseMetadata(200, {}),
			};
		},
	});
}

async function getPullPageDataResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	const pull = await getCachedPullResponse({
		context,
		data,
		resource: "pulls.detail.raw",
		freshForMs: githubCachePolicy.detail.staleTimeMs,
	});

	const totalComments = pull.comments ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalComments / COMMENTS_PER_PAGE));
	const issueData = {
		owner: data.owner,
		repo: data.repo,
		issueNumber: data.pullNumber,
	};

	const pagesToFetch = totalPages === 1 ? [1] : [1, totalPages];

	const [commentsPages, commits, timelineResult] = await Promise.all([
		Promise.all(
			pagesToFetch.map((p) =>
				getCommentsPageResult(context, { ...issueData, page: p }),
			),
		),
		getPullCommitsResult(context, data),
		getTimelineEventsResult(context, issueData),
	]);

	const allComments = commentsPages.flatMap((p) => p.comments);

	return {
		detail: mapPullDetail(pull, buildRepositoryRef(data.owner, data.repo)),
		comments: allComments,
		commits,
		events: timelineResult.events,
		commentPagination: {
			totalCount: totalComments,
			perPage: COMMENTS_PER_PAGE,
			loadedPages: pagesToFetch,
		},
		eventPagination: {
			loadedPages: [1],
			hasMore: timelineResult.hasMore,
		},
	};
}

async function getIssueDetailResult(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssueDetail | null> {
	const issueNamespaceKey = githubRevalidationSignalKeys.issueEntity({
		owner: data.owner,
		repo: data.repo,
		issueNumber: data.issueNumber,
	});

	return getCachedGitHubRequest<RepoIssueDetail, IssueDetail | null>({
		context,
		resource: "issues.detail",
		params: data,
		freshForMs: githubCachePolicy.detail.staleTimeMs,
		signalKeys: [issueNamespaceKey],
		namespaceKeys: [issueNamespaceKey],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.issues.get({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				headers,
			}),
		mapData: (issue) => {
			if (issue.pull_request) {
				return null;
			}

			return mapIssueDetail(issue, buildRepositoryRef(data.owner, data.repo));
		},
	});
}

async function getIssueCommentsResult(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssueComment[]> {
	type RawIssueComment = Awaited<
		ReturnType<GitHubClient["rest"]["issues"]["listComments"]>
	>["data"][number];
	const issueNamespaceKey = githubRevalidationSignalKeys.issueEntity({
		owner: data.owner,
		repo: data.repo,
		issueNumber: data.issueNumber,
	});

	return getCachedGitHubRequest<RawIssueComment[], IssueComment[]>({
		context,
		resource: "issues.comments",
		params: data,
		freshForMs: githubCachePolicy.activity.staleTimeMs,
		signalKeys: [issueNamespaceKey],
		namespaceKeys: [issueNamespaceKey],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.issues.listComments({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				per_page: 30,
				headers,
			}),
		mapData: (comments) =>
			comments.map((comment) => ({
				id: comment.id,
				body: comment.body ?? "",
				createdAt: comment.created_at,
				author: comment.user
					? {
							login: comment.user.login,
							avatarUrl: comment.user.avatar_url,
							url: comment.user.html_url,
							type: comment.user.type ?? "User",
						}
					: null,
			})),
	});
}

async function getIssuePageDataResult(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssuePageData> {
	const detail = await getIssueDetailResult(context, data);

	const totalComments = detail?.comments ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalComments / COMMENTS_PER_PAGE));
	const issueData = {
		owner: data.owner,
		repo: data.repo,
		issueNumber: data.issueNumber,
	};

	const pagesToFetch = totalPages === 1 ? [1] : [1, totalPages];

	const [commentsPages, timelineResult] = await Promise.all([
		Promise.all(
			pagesToFetch.map((p) =>
				getCommentsPageResult(context, { ...issueData, page: p }),
			),
		),
		getTimelineEventsResult(context, issueData),
	]);

	const allComments = commentsPages.flatMap((p) => p.comments);

	return {
		detail,
		comments: allComments,
		events: timelineResult.events,
		commentPagination: {
			totalCount: totalComments,
			perPage: COMMENTS_PER_PAGE,
			loadedPages: pagesToFetch,
		},
		eventPagination: {
			loadedPages: [1],
			hasMore: timelineResult.hasMore,
		},
	};
}

async function runWithConcurrency<TValue>(
	tasks: Array<() => Promise<TValue>>,
	concurrency = 2,
) {
	const results = new Array<TValue>(tasks.length);
	let nextIndex = 0;

	const workers = Array.from(
		{ length: Math.min(Math.max(concurrency, 1), tasks.length) },
		() =>
			(async () => {
				while (nextIndex < tasks.length) {
					const taskIndex = nextIndex;
					nextIndex += 1;
					results[taskIndex] = await tasks[taskIndex]();
				}
			})(),
	);

	await Promise.all(workers);

	return results;
}

async function getViewer(context: GitHubContext): Promise<AuthenticatedUser> {
	return getCachedGitHubRequest<AuthenticatedUser, AuthenticatedUser>({
		context,
		resource: "viewer",
		params: null,
		freshForMs: githubCachePolicy.viewer.staleTimeMs,
		namespaceKeys: ["viewer"],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.users.getAuthenticated({ headers }),
		mapData: (viewer) => viewer,
	});
}

async function resolveUsername(context: GitHubContext, username?: string) {
	if (username) {
		return username;
	}

	const viewer = await getViewer(context);
	return viewer.login;
}

async function getMyPullSlice({
	context,
	username,
	roleKey,
	role,
}: {
	context: GitHubContext;
	username: string;
	roleKey: keyof MyPullsResult;
	role: PullSearchRole;
}) {
	return getCachedGitHubRequest<SearchResult, PullSummary[]>({
		context,
		resource: `pulls.mine.${roleKey}`,
		params: { username, role },
		freshForMs: githubCachePolicy.list.staleTimeMs,
		signalKeys: [githubRevalidationSignalKeys.pullsMine],
		namespaceKeys: [githubRevalidationSignalKeys.pullsMine],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.search.issuesAndPullRequests({
				q: buildUserSearchQuery({
					itemType: "pr",
					role,
					state: "open",
					username,
				}),
				per_page: 30,
				sort: "updated",
				order: "desc",
				headers,
			}),
		mapData: (result) => mapPullSearchItems(result.items),
	});
}

async function getMyIssueSlice({
	context,
	username,
	roleKey,
	role,
}: {
	context: GitHubContext;
	username: string;
	roleKey: keyof MyIssuesResult;
	role: IssueSearchRole;
}) {
	return getCachedGitHubRequest<SearchResult, IssueSummary[]>({
		context,
		resource: `issues.mine.${roleKey}`,
		params: { username, role },
		freshForMs: githubCachePolicy.list.staleTimeMs,
		signalKeys: [githubRevalidationSignalKeys.issuesMine],
		namespaceKeys: [githubRevalidationSignalKeys.issuesMine],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.search.issuesAndPullRequests({
				q: buildUserSearchQuery({
					itemType: "issue",
					role,
					state: "open",
					username,
				}),
				per_page: 30,
				sort: "updated",
				order: "desc",
				headers,
			}),
		mapData: (result) => mapIssueSearchItems(result.items),
	});
}

function identityValidator<TInput>(data: TInput) {
	return data;
}

export const getGitHubRevalidationSignalRecords = createServerFn({
	method: "POST",
})
	.inputValidator(identityValidator<GitHubRevalidationSignalInput>)
	.handler(async ({ data }) => {
		const { getRequestSession } = await import("./auth-runtime");
		const session = await getRequestSession();
		if (!session) {
			return [];
		}

		return getGitHubRevalidationSignals(data.signalKeys);
	});

export const getGitHubViewer = createServerFn({ method: "GET" }).handler(
	async () => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		const viewer = await getViewer(context);

		return {
			id: viewer.id,
			login: viewer.login,
			name: viewer.name,
			avatarUrl: viewer.avatar_url,
			url: viewer.html_url,
		};
	},
);

export const getGitHubAppAccessState = createServerFn({
	method: "GET",
}).handler(async (): Promise<GitHubAppAccessState | null> => {
	const context = await getGitHubContext();
	if (!context) {
		return null;
	}

	const viewer = await getViewer(context);
	const appSlug = getGitHubAppSlug();
	const appAuthorizationUrl = buildGitHubAppAuthorizePath();
	const publicInstallUrl = buildGitHubAppInstallUrl(appSlug);
	const { installations, installationsAvailable } =
		await getGitHubAppUserInstallations(context.session.user.id);

	let organizations: GitHubOrganization[] = [];
	try {
		const organizationsResponse = await context.octokit.request(
			"GET /user/orgs",
			{
				per_page: 100,
			},
		);
		const payload =
			organizationsResponse.data as GitHubAuthenticatedOrgPayload[];
		organizations = payload.flatMap((organization) => {
			if (!organization.id || !organization.login) {
				return [];
			}

			return [
				{
					id: organization.id,
					login: organization.login,
					avatarUrl: organization.avatar_url ?? null,
				},
			];
		});
	} catch (error) {
		console.error("[github-access] failed to load organizations", error);
	}

	const viewerLogin = viewer.login;
	const personalInstallation =
		installations.find(
			(installation) =>
				installation.targetType === "User" ||
				installation.account.login.toLowerCase() === viewerLogin.toLowerCase(),
		) ?? null;
	const orgInstallations = installations.filter(
		(installation) => installation.targetType === "Organization",
	);
	const organizationByLogin = new Map(
		organizations.map((organization) => [
			organization.login.toLowerCase(),
			organization,
		]),
	);
	for (const installation of orgInstallations) {
		if (!organizationByLogin.has(installation.account.login.toLowerCase())) {
			organizationByLogin.set(installation.account.login.toLowerCase(), {
				id: installation.account.id ?? installation.id,
				login: installation.account.login,
				avatarUrl: installation.account.avatarUrl,
			});
		}
	}
	organizations = [...organizationByLogin.values()];
	const installedOrganizationLogins = new Set(
		orgInstallations.map((installation) =>
			installation.account.login.toLowerCase(),
		),
	);

	return {
		viewerLogin,
		appSlug,
		appAuthorizationUrl,
		publicInstallUrl,
		installationsAvailable,
		personalInstallation,
		orgInstallations,
		organizations,
		missingOrganizations: organizations.filter(
			(organization) =>
				!installedOrganizationLogins.has(organization.login.toLowerCase()),
		),
	};
});

export const getUserRepos = createServerFn({ method: "GET" }).handler(
	async (): Promise<UserRepoSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		return getCachedGitHubRequest<AuthenticatedUserRepo[], UserRepoSummary[]>({
			context,
			resource: "repos.list",
			params: { sort: "updated", perPage: 10 },
			freshForMs: githubCachePolicy.reposList.staleTimeMs,
			namespaceKeys: ["repos.list"],
			cacheMode: "split",
			request: (headers) =>
				context.octokit.rest.repos.listForAuthenticatedUser({
					sort: "updated",
					per_page: 10,
					headers,
				}),
			mapData: (repos) =>
				repos.map(
					(repo: AuthenticatedUserRepo): UserRepoSummary => ({
						id: repo.id,
						name: repo.name,
						fullName: repo.full_name,
						description: repo.description,
						stars: repo.stargazers_count,
						language: repo.language,
						updatedAt: repo.updated_at,
						isPrivate: repo.private,
						url: repo.html_url,
						owner: repo.owner.login,
					}),
				),
		});
	},
);

export const searchCommandPaletteGitHub = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<CommandPaletteSearchInput>)
	.handler(async ({ data }): Promise<CommandPaletteSearchResult> => {
		const query = normalizeCommandPaletteSearchQuery(data.query);
		if (query.length < 2) {
			return emptyCommandPaletteSearchResult();
		}

		const context = await getGitHubContext();
		if (!context) {
			return emptyCommandPaletteSearchResult();
		}

		const perPage = clampCommandSearchPerPage(data.perPage);
		const [repositories, users, pullItems, issueItems] = await Promise.all([
			safeCommandPaletteSearch({
				label: "repositories",
				fallback: [] as UserRepoSummary[],
				task: async () => {
					const response = await context.octokit.rest.search.repos({
						q: `${query} in:name,description fork:true`,
						per_page: perPage,
						sort: "updated",
						order: "desc",
					});
					return response.data.items.map(mapRepositorySearchItem);
				},
			}),
			safeCommandPaletteSearch({
				label: "users",
				fallback: [] as GitHubAccountSummary[],
				task: async () => {
					const response = await context.octokit.rest.search.users({
						q: `${query} in:login,fullname`,
						per_page: perPage,
					});
					return response.data.items
						.map((user) => mapGitHubAccountSearchItem(user))
						.filter((user): user is GitHubAccountSummary => Boolean(user));
				},
			}),
			safeCommandPaletteSearch({
				label: "pull requests",
				fallback: [] as SearchItem[],
				task: async () => {
					const response =
						await context.octokit.rest.search.issuesAndPullRequests({
							q: `${query} is:pr in:title,body archived:false`,
							per_page: perPage,
							sort: "updated",
							order: "desc",
						});
					return response.data.items;
				},
			}),
			safeCommandPaletteSearch({
				label: "issues",
				fallback: [] as SearchItem[],
				task: async () => {
					const response =
						await context.octokit.rest.search.issuesAndPullRequests({
							q: `${query} is:issue in:title,body archived:false`,
							per_page: perPage,
							sort: "updated",
							order: "desc",
						});
					return response.data.items;
				},
			}),
		]);

		return {
			repositories,
			users,
			pulls: mapPullSearchItems(pullItems),
			issues: mapIssueSearchItems(issueItems),
		};
	});

function toInstallationTargetType(
	value: string | undefined,
): GitHubInstallationTargetType {
	if (value === "Organization" || value === "User") {
		return value;
	}

	return "Unknown";
}

export const getMyPulls = createServerFn({ method: "GET" }).handler(
	async (): Promise<MyPullsResult> => {
		const context = await getGitHubContext();
		if (!context) {
			return {
				reviewRequested: [],
				assigned: [],
				authored: [],
				mentioned: [],
				involved: [],
			};
		}

		const viewer = await getViewer(context);
		const slices = await runWithConcurrency(
			myPullRoleDefinitions.map((definition) => async () => ({
				key: definition.key,
				data: await getMyPullSlice({
					context,
					username: viewer.login,
					roleKey: definition.key,
					role: definition.role,
				}),
			})),
			2,
		);

		return slices.reduce<MyPullsResult>(
			(accumulator, slice) => {
				accumulator[slice.key] = slice.data;
				return accumulator;
			},
			{
				reviewRequested: [],
				assigned: [],
				authored: [],
				mentioned: [],
				involved: [],
			},
		);
	},
);

export const getPullsFromUser = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullsFromUserInput>)
	.handler(async ({ data }): Promise<PullSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		const username = await resolveUsername(context, data.username);

		return getCachedGitHubRequest<SearchResult, PullSummary[]>({
			context,
			resource: "pulls.user",
			params: {
				username,
				state: data.state ?? "open",
				page: clampPage(data.page),
				perPage: clampPerPage(data.perPage),
				role: data.role ?? "author",
				owner: data.owner,
				repo: data.repo,
			},
			freshForMs: githubCachePolicy.list.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.pullsMine],
			request: (headers) =>
				context.octokit.rest.search.issuesAndPullRequests({
					q: buildUserSearchQuery({
						itemType: "pr",
						role: data.role ?? "author",
						state: data.state ?? "open",
						username,
						owner: data.owner,
						repo: data.repo,
					}),
					page: clampPage(data.page),
					per_page: clampPerPage(data.perPage),
					sort: "updated",
					order: "desc",
					headers,
				}),
			mapData: (result) => mapPullSearchItems(result.items),
		});
	});

export const getPullsFromRepo = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullsFromRepoInput>)
	.handler(async ({ data }): Promise<PullSummary[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getCachedGitHubRequest<
			Awaited<ReturnType<GitHubClient["rest"]["pulls"]["list"]>>["data"],
			PullSummary[]
		>({
			context,
			resource: "pulls.repo",
			params: {
				owner: data.owner,
				repo: data.repo,
				state: data.state ?? "open",
				page: clampPage(data.page),
				perPage: clampPerPage(data.perPage),
				sort: data.sort ?? "updated",
				direction: data.direction ?? "desc",
			},
			freshForMs: githubCachePolicy.list.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.pullsMine],
			request: (headers) =>
				context.octokit.rest.pulls.list({
					owner: data.owner,
					repo: data.repo,
					state: data.state ?? "open",
					page: clampPage(data.page),
					per_page: clampPerPage(data.perPage),
					sort: data.sort ?? "updated",
					direction: data.direction ?? "desc",
					headers,
				}),
			mapData: (pulls) =>
				pulls.map((pull) =>
					mapPullSummary(pull, buildRepositoryRef(data.owner, data.repo)),
				),
		});
	});

export const getCommentPage = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<CommentPageInput>)
	.handler(async ({ data }) => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { comments: [], total: 0 };
		}

		return getCommentsPageResult(context, data);
	});

type TimelineEventPageInput = {
	owner: string;
	repo: string;
	issueNumber: number;
	page: number;
};

export const getTimelineEventPage = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<TimelineEventPageInput>)
	.handler(async ({ data }) => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { events: [], hasMore: false };
		}

		return getRestTimelineEventsPage(context, data, data.page);
	});

export const getPullFromRepo = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullDetail | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getPullDetailResult(context, data);
	});

export const getPullComments = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullComment[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getPullCommentsResult(context, data);
	});

export const getMyIssues = createServerFn({ method: "GET" }).handler(
	async (): Promise<MyIssuesResult> => {
		const context = await getGitHubContext();
		if (!context) {
			return {
				assigned: [],
				authored: [],
				mentioned: [],
			};
		}

		const viewer = await getViewer(context);
		const slices = await runWithConcurrency(
			myIssueRoleDefinitions.map((definition) => async () => ({
				key: definition.key,
				data: await getMyIssueSlice({
					context,
					username: viewer.login,
					roleKey: definition.key,
					role: definition.role,
				}),
			})),
			2,
		);

		return slices.reduce<MyIssuesResult>(
			(accumulator, slice) => {
				accumulator[slice.key] = slice.data;
				return accumulator;
			},
			{
				assigned: [],
				authored: [],
				mentioned: [],
			},
		);
	},
);

export const getIssuesFromUser = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<IssuesFromUserInput>)
	.handler(async ({ data }): Promise<IssueSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		const username = await resolveUsername(context, data.username);

		return getCachedGitHubRequest<SearchResult, IssueSummary[]>({
			context,
			resource: "issues.user",
			params: {
				username,
				state: data.state ?? "open",
				page: clampPage(data.page),
				perPage: clampPerPage(data.perPage),
				role: data.role ?? "author",
				owner: data.owner,
				repo: data.repo,
			},
			freshForMs: githubCachePolicy.list.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.issuesMine],
			request: (headers) =>
				context.octokit.rest.search.issuesAndPullRequests({
					q: buildUserSearchQuery({
						itemType: "issue",
						role: data.role ?? "author",
						state: data.state ?? "open",
						username,
						owner: data.owner,
						repo: data.repo,
					}),
					page: clampPage(data.page),
					per_page: clampPerPage(data.perPage),
					sort: "updated",
					order: "desc",
					headers,
				}),
			mapData: (result) => mapIssueSearchItems(result.items),
		});
	});

export const getIssuesFromRepo = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<IssuesFromRepoInput>)
	.handler(async ({ data }): Promise<IssueSummary[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getCachedGitHubRequest<
			Awaited<
				ReturnType<GitHubClient["rest"]["issues"]["listForRepo"]>
			>["data"],
			IssueSummary[]
		>({
			context,
			resource: "issues.repo",
			params: {
				owner: data.owner,
				repo: data.repo,
				state: data.state ?? "open",
				page: clampPage(data.page),
				perPage: clampPerPage(data.perPage),
				sort: data.sort ?? "updated",
				direction: data.direction ?? "desc",
			},
			freshForMs: githubCachePolicy.list.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.issuesMine],
			request: (headers) =>
				context.octokit.rest.issues.listForRepo({
					owner: data.owner,
					repo: data.repo,
					state: data.state ?? "open",
					page: clampPage(data.page),
					per_page: clampPerPage(data.perPage),
					sort: data.sort ?? "updated",
					direction: data.direction ?? "desc",
					headers,
				}),
			mapData: (issues) =>
				issues
					.filter((issue) => !issue.pull_request)
					.map((issue) =>
						mapIssueSummary(issue, buildRepositoryRef(data.owner, data.repo)),
					),
		});
	});

export const getIssueFromRepo = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<IssueFromRepoInput>)
	.handler(async ({ data }): Promise<IssueDetail | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getIssueDetailResult(context, data);
	});

export const getIssueComments = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<IssueFromRepoInput>)
	.handler(async ({ data }): Promise<IssueComment[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getIssueCommentsResult(context, data);
	});

export const getIssuePageData = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<IssueFromRepoInput>)
	.handler(async ({ data }): Promise<IssuePageData | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getIssuePageDataResult(context, data);
	});

export const getPullStatus = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullStatus | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getPullStatusResult(context, data);
	});

export const getPullPageData = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullPageData | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		return getPullPageDataResult(context, data);
	});

type UpdatePullBodyInput = PullFromRepoInput & { body: string };

export const updatePullBody = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<UpdatePullBodyInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return false;
		}

		try {
			await context.octokit.rest.pulls.update({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				body: data.body,
			});
			await bustPullDetailCaches(context.session.user.id, data);
			return true;
		} catch {
			return false;
		}
	});

export const updatePullBranch = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.updateBranch({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
			});
			await bustPullDetailCaches(context.session.user.id, data);
			return { ok: true };
		} catch (error) {
			return toMutationError("update branch", error);
		}
	});

export type MergePullInput = PullFromRepoInput & {
	mergeMethod: "merge" | "squash" | "rebase";
	bypassProtections?: boolean;
};

export const mergePullRequest = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<MergePullInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.merge({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				merge_method: data.mergeMethod,
			});
			await bustPullDetailCaches(context.session.user.id, data);
			return { ok: true };
		} catch (error) {
			return toMutationError("merge pull request", error);
		}
	});

export const deleteBranch = createServerFn({ method: "POST" })
	.inputValidator(
		identityValidator<{ owner: string; repo: string; branch: string }>,
	)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.git.deleteRef({
				owner: data.owner,
				repo: data.repo,
				ref: `heads/${data.branch}`,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("delete branch", error);
		}
	});

async function getPullFilesResult(
	context: GitHubContext,
	data: PullFilesPageInput,
): Promise<PullFilesPage> {
	const page = clampPage(data.page);
	const perPage = clampPerPage(data.perPage, 20);
	const pullNamespaceKey = githubRevalidationSignalKeys.pullEntity({
		owner: data.owner,
		repo: data.repo,
		pullNumber: data.pullNumber,
	});

	return getCachedGitHubRequest<RepoPullFile[], PullFilesPage>({
		context,
		resource: "pulls.filesPage",
		params: {
			owner: data.owner,
			repo: data.repo,
			pullNumber: data.pullNumber,
			page,
			perPage,
		},
		freshForMs: githubCachePolicy.detail.staleTimeMs,
		signalKeys: [pullNamespaceKey],
		namespaceKeys: [pullNamespaceKey],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.pulls.listFiles({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				page,
				per_page: perPage,
				headers,
			}),
		mapData: (files) => ({
			files: files.map((file) => ({
				sha: file.sha,
				filename: file.filename,
				status: file.status as PullFile["status"],
				additions: file.additions,
				deletions: file.deletions,
				changes: file.changes,
				patch: file.patch ?? null,
				previousFilename: file.previous_filename ?? null,
			})),
			nextPage: files.length === perPage ? page + 1 : null,
		}),
	});
}

async function getPullFileSummariesResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullFileSummary[]> {
	const pullNamespaceKey = githubRevalidationSignalKeys.pullEntity({
		owner: data.owner,
		repo: data.repo,
		pullNumber: data.pullNumber,
	});

	return getCachedPaginatedGitHubRequest<RepoPullFile, PullFileSummary[]>({
		context,
		resource: "pulls.fileSummaries",
		params: data,
		freshForMs: githubCachePolicy.detail.staleTimeMs,
		signalKeys: [pullNamespaceKey],
		namespaceKeys: [pullNamespaceKey],
		cacheMode: "split",
		request: (page) =>
			context.octokit.rest.pulls.listFiles({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				page,
				per_page: 100,
			}),
		mapData: (files) =>
			files.map((file) => ({
				filename: file.filename,
				status: file.status as PullFileSummary["status"],
				additions: file.additions,
				deletions: file.deletions,
				changes: file.changes,
				previousFilename: file.previous_filename ?? null,
			})),
	});
}

export const getPullFileSummaries = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullFileSummary[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getPullFileSummariesResult(context, data);
	});

export const getPullFiles = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFilesPageInput>)
	.handler(async ({ data }): Promise<PullFilesPage> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { files: [], nextPage: null };
		}

		return getPullFilesResult(context, data);
	});

async function getPullReviewCommentsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullReviewComment[]> {
	const pullNamespaceKey = githubRevalidationSignalKeys.pullEntity({
		owner: data.owner,
		repo: data.repo,
		pullNumber: data.pullNumber,
	});

	return getCachedPaginatedGitHubRequest<
		RepoPullReviewComment,
		PullReviewComment[]
	>({
		context,
		resource: "pulls.reviewComments",
		params: data,
		freshForMs: githubCachePolicy.activity.staleTimeMs,
		signalKeys: [pullNamespaceKey],
		namespaceKeys: [pullNamespaceKey],
		cacheMode: "split",
		request: (page) =>
			context.octokit.rest.pulls.listReviewComments({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				page,
				per_page: 100,
			}),
		mapData: (comments) =>
			comments.map((comment) => ({
				id: comment.id,
				body: comment.body,
				path: comment.path,
				line: comment.line ?? null,
				side: (comment.side?.toUpperCase() as "LEFT" | "RIGHT") ?? "RIGHT",
				createdAt: comment.created_at,
				updatedAt: comment.updated_at,
				author: comment.user
					? {
							login: comment.user.login,
							avatarUrl: comment.user.avatar_url,
							url: comment.user.html_url,
							type: comment.user.type ?? "User",
						}
					: null,
				inReplyToId: comment.in_reply_to_id ?? null,
				diffHunk: comment.diff_hunk,
			})),
	});
}

export const getPullReviewComments = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullReviewComment[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getPullReviewCommentsResult(context, data);
	});

export const submitPullReview = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<SubmitReviewInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return false;
		}

		try {
			await context.octokit.rest.pulls.createReview({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				body: data.body,
				event: data.event,
				comments: data.comments?.map((c) => ({
					path: c.path,
					line: c.line,
					side: c.side,
					body: c.body,
					...(c.startLine != null && c.startLine !== c.line
						? { start_line: c.startLine, start_side: c.startSide ?? c.side }
						: {}),
				})),
			});
			await bustPullDetailCaches(context.session.user.id, {
				owner: data.owner,
				repo: data.repo,
				pullNumber: data.pullNumber,
			});
			return true;
		} catch {
			return false;
		}
	});

export const createReviewComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<CreateReviewCommentInput>)
	.handler(async ({ data }): Promise<PullReviewComment | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		try {
			const response = await context.octokit.rest.pulls.createReviewComment({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				body: data.body,
				commit_id: data.commitId,
				path: data.path,
				line: data.line,
				side: data.side,
			});

			const comment = response.data;
			await bustPullReviewCaches(context.session.user.id, {
				owner: data.owner,
				repo: data.repo,
				pullNumber: data.pullNumber,
			});

			return {
				id: comment.id,
				body: comment.body,
				path: comment.path,
				line: comment.line ?? null,
				side: (comment.side?.toUpperCase() as "LEFT" | "RIGHT") ?? "RIGHT",
				createdAt: comment.created_at,
				updatedAt: comment.updated_at,
				author: comment.user
					? {
							login: comment.user.login,
							avatarUrl: comment.user.avatar_url,
							url: comment.user.html_url,
							type: comment.user.type ?? "User",
						}
					: null,
				inReplyToId: comment.in_reply_to_id ?? null,
				diffHunk: comment.diff_hunk,
			};
		} catch {
			return null;
		}
	});

export type RepoCollaboratorsInput = {
	owner: string;
	repo: string;
};

export const getRepoCollaborators = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoCollaboratorsInput>)
	.handler(async ({ data }): Promise<RepoCollaborator[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		const collaboratorsPromise = getCachedPaginatedGitHubRequest<
			Awaited<
				ReturnType<GitHubClient["rest"]["repos"]["listCollaborators"]>
			>["data"][number],
			RepoCollaborator[]
		>({
			context,
			resource: "repos.collaborators",
			params: data,
			freshForMs: githubCachePolicy.viewer.staleTimeMs,
			namespaceKeys: [
				githubRevalidationSignalKeys.repoCollaborators({
					owner: data.owner,
					repo: data.repo,
				}),
			],
			cacheMode: "split",
			request: (page) =>
				context.octokit.rest.repos.listCollaborators({
					owner: data.owner,
					repo: data.repo,
					permission: "push",
					page,
					per_page: 100,
				}),
			mapData: (allCollaborators) =>
				allCollaborators
					.map((c) => ({
						login: c.login,
						avatarUrl: c.avatar_url,
						url: c.html_url,
						type: c.type ?? "User",
						permissions: {
							admin: c.permissions?.admin ?? false,
							push: c.permissions?.push ?? false,
							pull: c.permissions?.pull ?? false,
						},
					}))
					.filter(
						(candidate) =>
							!isOwnGitHubAppBot(candidate.login) &&
							isReviewerCandidate(candidate),
					),
		}).catch(() => []);
		const botsPromise = getCachedRepoReviewerBots(context, data).catch(
			() => [],
		);

		const [collaborators, bots] = await Promise.all([
			collaboratorsPromise,
			botsPromise,
		]);

		return mergeReviewerCandidates(collaborators, bots);
	});

export type OrgTeamsInput = {
	org: string;
	owner: string;
	repo: string;
};

export const getOrgTeams = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<OrgTeamsInput>)
	.handler(async ({ data }): Promise<OrgTeam[]> => {
		const context = await getGitHubContextForOwner(data.org);
		if (!context) {
			return [];
		}

		const teams = await getCachedPaginatedGitHubRequest<
			Awaited<
				ReturnType<GitHubClient["rest"]["teams"]["list"]>
			>["data"][number],
			OrgTeam[]
		>({
			context,
			resource: "org.teams",
			params: data,
			freshForMs: githubCachePolicy.viewer.staleTimeMs,
			namespaceKeys: [githubRevalidationSignalKeys.orgTeams({ org: data.org })],
			cacheMode: "split",
			request: (page) =>
				context.octokit.rest.teams.list({
					org: data.org,
					page,
					per_page: 100,
				}),
			mapData: (allTeams) =>
				allTeams.map((team) => ({
					slug: team.slug,
					name: team.name,
				})),
		}).catch(() => []);

		const teamsWithAccess = await Promise.all(
			teams.map(async (team) =>
				(await orgTeamHasRepoAccess(context, data, team)) ? team : null,
			),
		);

		return teamsWithAccess.filter((team): team is OrgTeam => Boolean(team));
	});

export const requestPullReviewers = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<RequestReviewersInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.requestReviewers({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				reviewers: data.reviewers ?? [],
				team_reviewers: data.teamReviewers ?? [],
			});
			await bustPullDetailCaches(context.session.user.id, {
				owner: data.owner,
				repo: data.repo,
				pullNumber: data.pullNumber,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("request reviewers", error);
		}
	});

export const removeReviewRequest = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<RequestReviewersInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.removeRequestedReviewers({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				reviewers: data.reviewers ?? [],
				team_reviewers: data.teamReviewers ?? [],
			});
			await bustPullDetailCaches(context.session.user.id, {
				owner: data.owner,
				repo: data.repo,
				pullNumber: data.pullNumber,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("remove review request", error);
		}
	});

export type DismissReviewInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	reviewId: number;
	message: string;
};

export const dismissPullReview = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<DismissReviewInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.dismissReview({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				review_id: data.reviewId,
				message: data.message,
			});
			await bustPullDetailCaches(context.session.user.id, {
				owner: data.owner,
				repo: data.repo,
				pullNumber: data.pullNumber,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("dismiss review", error);
		}
	});

export type RepoLabelsInput = {
	owner: string;
	repo: string;
};

export const getRepoLabels = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoLabelsInput>)
	.handler(async ({ data }): Promise<GitHubLabel[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getCachedPaginatedGitHubRequest<
			Awaited<
				ReturnType<GitHubClient["rest"]["issues"]["listLabelsForRepo"]>
			>["data"][number],
			GitHubLabel[]
		>({
			context,
			resource: "repos.labels",
			params: data,
			freshForMs: githubCachePolicy.viewer.staleTimeMs,
			namespaceKeys: [
				githubRevalidationSignalKeys.repoLabels({
					owner: data.owner,
					repo: data.repo,
				}),
			],
			cacheMode: "split",
			request: (page) =>
				context.octokit.rest.issues.listLabelsForRepo({
					owner: data.owner,
					repo: data.repo,
					page,
					per_page: 100,
				}),
			mapData: (allLabels) =>
				allLabels.map((l) => ({
					name: l.name,
					color: l.color ?? "000000",
					description: l.description ?? null,
				})),
		}).catch(() => []);
	});

export const setIssueLabels = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<SetLabelsInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return false;
		}

		try {
			await context.octokit.rest.issues.setLabels({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				labels: data.labels,
			});
			const userId = context.session.user.id;
			await Promise.all([
				bustPullDetailCaches(userId, {
					owner: data.owner,
					repo: data.repo,
					pullNumber: data.issueNumber,
				}),
				bustIssueCaches(userId, {
					owner: data.owner,
					repo: data.repo,
					issueNumber: data.issueNumber,
				}),
			]);
			return true;
		} catch {
			return false;
		}
	});

export const createRepoLabel = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<CreateLabelInput>)
	.handler(async ({ data }): Promise<GitHubLabel | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return null;
		}

		try {
			const response = await context.octokit.rest.issues.createLabel({
				owner: data.owner,
				repo: data.repo,
				name: data.name,
				color: data.color,
			});
			await bumpGitHubCacheNamespaces([
				githubRevalidationSignalKeys.repoLabels({
					owner: data.owner,
					repo: data.repo,
				}),
			]);
			return {
				name: response.data.name,
				color: response.data.color ?? "000000",
				description: response.data.description ?? null,
			};
		} catch {
			return null;
		}
	});
