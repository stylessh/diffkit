import { createServerFn } from "@tanstack/react-start";
import { type Octokit as OctokitType, RequestError } from "octokit";
import { debug } from "./debug";
import type {
	CommandPaletteSearchResult,
	ContributionDay,
	ContributionWeek,
	CreateLabelInput,
	CreateReviewCommentInput,
	DiscussionsResult,
	GitHubActor,
	GitHubContributionCalendar,
	GitHubLabel,
	GitHubUserProfile,
	IssueComment,
	IssueDetail,
	IssuePageData,
	IssueSummary,
	MyIssuesResult,
	MyPullsResult,
	NotificationItem,
	NotificationParticipant,
	NotificationsResult,
	OrgTeam,
	PinnedRepo,
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
	ReplyToReviewCommentInput,
	RepoBranch,
	RepoCollaborator,
	RepoContributorsResult,
	RepoOverview,
	RepositoryRef,
	RepoTreeEntry,
	RequestedTeam,
	RequestReviewersInput,
	ReviewThreadInfo,
	SetLabelsInput,
	SubmitReviewInput,
	TimelineEvent,
	UserActivityEvent,
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
	getOrRevalidateGitHubResource,
} from "./github-cache";
import { githubCachePolicy } from "./github-cache-policy";
import { githubRevalidationSignalKeys } from "./github-revalidation";

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
type GitHubSearchOwnerScope = {
	login: string;
	targetType: GitHubInstallationTargetType;
};
type GitHubGraphQLSearchSource = {
	label: string;
	context: GitHubContext;
	owner?: GitHubSearchOwnerScope;
	excludeOwners?: GitHubSearchOwnerScope[];
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
type GitHubGraphQLRateLimit = {
	cost: number;
	remaining: number;
	resetAt: string;
};
type GitHubGraphQLActor = {
	login: string;
	avatarUrl: string;
	url: string;
	__typename?: string;
} | null;
type GitHubGraphQLLabel = {
	name: string;
	color: string;
	description: string | null;
};
type GitHubGraphQLRepositoryRef = {
	name: string;
	nameWithOwner: string;
	url: string;
	owner: {
		login: string;
	};
};
type GitHubGraphQLCommentNode = {
	id: string;
	databaseId: number | null;
	body: string;
	createdAt: string;
	author: GitHubGraphQLActor;
};
type GitHubGraphQLCommentConnection = {
	totalCount: number;
	nodes: Array<GitHubGraphQLCommentNode | null> | null;
};
type GitHubGraphQLSearchConnection<TNode> = {
	nodes: Array<TNode | null> | null;
};
type GitHubGraphQLPullSearchNode = {
	__typename: "PullRequest";
	databaseId: number | null;
	number: number;
	title: string;
	state: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	mergedAt: string | null;
	url: string;
	comments: {
		totalCount: number;
	};
	author: GitHubGraphQLActor;
	labels: {
		nodes: Array<GitHubGraphQLLabel | null> | null;
	} | null;
	repository: GitHubGraphQLRepositoryRef;
};
type GitHubGraphQLIssueSearchNode = {
	__typename: "Issue";
	databaseId: number | null;
	number: number;
	title: string;
	state: string;
	stateReason: string | null;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	url: string;
	comments: {
		totalCount: number;
	};
	author: GitHubGraphQLActor;
	labels: {
		nodes: Array<GitHubGraphQLLabel | null> | null;
	} | null;
	repository: GitHubGraphQLRepositoryRef;
};
type GitHubGraphQLRepoOverviewResponse = {
	repository: {
		databaseId: number | null;
		name: string;
		nameWithOwner: string;
		description: string | null;
		isPrivate: boolean;
		isFork: boolean;
		defaultBranchRef: {
			name: string;
			target: {
				__typename: string;
				oid?: string;
				message?: string;
				committedDate?: string;
				author?: {
					user?: {
						login: string;
						avatarUrl: string;
						url: string;
					} | null;
				} | null;
			} | null;
		} | null;
		stargazerCount: number;
		forkCount: number;
		watchers: {
			totalCount: number;
		};
		primaryLanguage: {
			name: string;
		} | null;
		licenseInfo: {
			spdxId: string | null;
		} | null;
		repositoryTopics: {
			nodes: Array<{
				topic: {
					name: string;
				};
			} | null> | null;
		};
		url: string;
		owner: {
			login: string;
			avatarUrl: string;
		};
		branches: {
			totalCount: number;
		};
		tags: {
			totalCount: number;
		};
		pullRequests: {
			totalCount: number;
		};
		issues: {
			totalCount: number;
		};
		hasDiscussionsEnabled: boolean;
	} | null;
	rateLimit: GitHubGraphQLRateLimit;
};
type GitHubGraphQLReviewRequestNode = {
	requestedReviewer:
		| ({
				__typename: "User";
				login: string;
				avatarUrl: string;
				url: string;
		  } & Record<string, unknown>)
		| {
				__typename: "Team";
				name: string;
				slug: string;
				url: string;
		  }
		| null;
};
type GitHubGraphQLPullPageResponse = {
	repository: {
		pullRequest: {
			databaseId: number | null;
			number: number;
			title: string;
			state: string;
			isDraft: boolean;
			createdAt: string;
			updatedAt: string;
			closedAt: string | null;
			mergedAt: string | null;
			url: string;
			body: string;
			additions: number;
			deletions: number;
			changedFiles: number;
			comments: { totalCount: number };
			author: GitHubGraphQLActor;
			labels: {
				nodes: Array<GitHubGraphQLLabel | null> | null;
			} | null;
			headRefName: string;
			headRefOid: string;
			headRepositoryOwner: { login: string } | null;
			baseRefName: string;
			merged: boolean;
			mergeCommit: { oid: string } | null;
			mergedBy: GitHubGraphQLActor;
			mergeable: string;
			mergeStateStatus: string;
			repository: GitHubGraphQLRepositoryRef;
			reviewThreads: { totalCount: number };
			reviewRequests: {
				nodes: Array<GitHubGraphQLReviewRequestNode | null> | null;
			} | null;
			commits: {
				totalCount: number;
				nodes: Array<{
					commit: {
						oid: string;
						message: string;
						committedDate: string;
						author: {
							user?: {
								login: string;
								avatarUrl: string;
								url: string;
							} | null;
						} | null;
					};
				} | null> | null;
			};
			firstComments: GitHubGraphQLCommentConnection;
			lastComments: GitHubGraphQLCommentConnection;
		} | null;
	};
	rateLimit: GitHubGraphQLRateLimit;
};
type GitHubGraphQLIssuePageResponse = {
	repository: {
		issue: {
			databaseId: number | null;
			number: number;
			title: string;
			state: string;
			stateReason: string | null;
			createdAt: string;
			updatedAt: string;
			closedAt: string | null;
			url: string;
			body: string;
			comments: { totalCount: number };
			author: GitHubGraphQLActor;
			labels: {
				nodes: Array<GitHubGraphQLLabel | null> | null;
			} | null;
			repository: GitHubGraphQLRepositoryRef;
			assignees: {
				nodes: Array<GitHubGraphQLActor | null> | null;
			} | null;
			milestone: {
				title: string;
				description: string | null;
				dueOn: string | null;
			} | null;
			firstComments: GitHubGraphQLCommentConnection;
			lastComments: GitHubGraphQLCommentConnection;
		} | null;
	};
	rateLimit: GitHubGraphQLRateLimit;
};
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
const GITHUB_OPERATION_TIMEOUT_MS = 15_000;
const GITHUB_PAGINATED_OPERATION_TIMEOUT_MS = 25_000;
const GITHUB_MIN_OPERATION_TIMEOUT_MS = 1_000;
const MY_SEARCH_BUCKET_LIMIT = 30;
const MY_SEARCH_SOURCE_TIMEOUT_MS = 8_000;
const MY_SEARCH_TOTAL_TIMEOUT_MS = 18_000;

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

function mapGraphQLActor(actor: GitHubGraphQLActor): GitHubActor | null {
	if (!actor?.login) {
		return null;
	}

	return {
		login: actor.login,
		avatarUrl: actor.avatarUrl,
		url: actor.url,
		type: actor.__typename ?? "User",
	};
}

function mapGraphQLRepositoryRef(
	repository: GitHubGraphQLRepositoryRef,
): RepositoryRef {
	const [ownerFromName, repoFromName] = repository.nameWithOwner.split("/");
	const owner = repository.owner.login || ownerFromName;

	return {
		name: repository.name || repoFromName,
		owner,
		fullName: repository.nameWithOwner,
		url: repository.url,
	};
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

function mapGraphQLLabels(
	labels: { nodes: Array<GitHubGraphQLLabel | null> | null } | null,
) {
	return (labels?.nodes ?? []).flatMap((label) =>
		label
			? [
					{
						name: label.name,
						color: label.color,
						description: label.description,
					},
				]
			: [],
	);
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
		headRepoOwner: pull.head.repo?.owner?.login ?? null,
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

function mapGraphQLPullSearchNode(
	node: GitHubGraphQLPullSearchNode | null,
): PullSummary | null {
	if (!node || node.__typename !== "PullRequest" || node.databaseId == null) {
		return null;
	}

	return {
		id: node.databaseId,
		number: node.number,
		title: node.title,
		state: node.state.toLowerCase(),
		isDraft: node.isDraft,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
		closedAt: node.closedAt,
		mergedAt: node.mergedAt,
		comments: node.comments.totalCount,
		url: node.url,
		author: mapGraphQLActor(node.author),
		labels: mapGraphQLLabels(node.labels),
		repository: mapGraphQLRepositoryRef(node.repository),
	};
}

function mapGraphQLIssueSearchNode(
	node: GitHubGraphQLIssueSearchNode | null,
): IssueSummary | null {
	if (!node || node.__typename !== "Issue" || node.databaseId == null) {
		return null;
	}

	return {
		id: node.databaseId,
		number: node.number,
		title: node.title,
		state: node.state.toLowerCase(),
		stateReason: node.stateReason?.toLowerCase() ?? null,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
		closedAt: node.closedAt,
		comments: node.comments.totalCount,
		url: node.url,
		author: mapGraphQLActor(node.author),
		labels: mapGraphQLLabels(node.labels),
		repository: mapGraphQLRepositoryRef(node.repository),
	};
}

function numericIdFromGraphQLId(id: string) {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

function mapGraphQLComments(
	...connections: GitHubGraphQLCommentConnection[]
): IssueComment[] {
	const byId = new Map<number, IssueComment>();

	for (const connection of connections) {
		for (const node of connection.nodes ?? []) {
			if (!node) {
				continue;
			}

			const id = node.databaseId ?? numericIdFromGraphQLId(node.id);
			byId.set(id, {
				id,
				body: node.body,
				createdAt: node.createdAt,
				author: mapGraphQLActor(node.author),
			});
		}
	}

	return [...byId.values()].sort(
		(a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
	);
}

function getLoadedCommentPages(totalComments: number) {
	const totalPages = Math.max(1, Math.ceil(totalComments / COMMENTS_PER_PAGE));
	return totalPages === 1 ? [1] : [1, totalPages];
}

function mapGraphQLPullDetail(
	pull: NonNullable<GitHubGraphQLPullPageResponse["repository"]["pullRequest"]>,
): PullDetail {
	const requestedReviewers: GitHubActor[] = [];
	const requestedTeams: RequestedTeam[] = [];

	for (const node of pull.reviewRequests?.nodes ?? []) {
		const reviewer = node?.requestedReviewer;
		if (!reviewer) {
			continue;
		}

		if (reviewer.__typename === "Team") {
			requestedTeams.push({
				slug: reviewer.slug,
				name: reviewer.name,
				url: reviewer.url,
			});
			continue;
		}

		const actor = mapGraphQLActor(reviewer);
		if (actor) {
			requestedReviewers.push(actor);
		}
	}

	return {
		id: pull.databaseId ?? 0,
		number: pull.number,
		title: pull.title,
		state: pull.state.toLowerCase(),
		isDraft: pull.isDraft,
		createdAt: pull.createdAt,
		updatedAt: pull.updatedAt,
		closedAt: pull.closedAt,
		mergedAt: pull.mergedAt,
		comments: pull.comments.totalCount,
		url: pull.url,
		author: mapGraphQLActor(pull.author),
		labels: mapGraphQLLabels(pull.labels),
		repository: mapGraphQLRepositoryRef(pull.repository),
		body: pull.body,
		additions: pull.additions,
		deletions: pull.deletions,
		changedFiles: pull.changedFiles,
		commits: pull.commits.totalCount,
		reviewComments: pull.reviewThreads.totalCount,
		headRefName: pull.headRefName,
		headSha: pull.headRefOid,
		headRepoOwner: pull.headRepositoryOwner?.login ?? null,
		baseRefName: pull.baseRefName,
		isMerged: pull.merged,
		mergeCommitSha: pull.mergeCommit?.oid ?? null,
		mergedBy: mapGraphQLActor(pull.mergedBy),
		mergeable:
			pull.mergeable === "MERGEABLE"
				? true
				: pull.mergeable === "CONFLICTING"
					? false
					: null,
		mergeableState: pull.mergeStateStatus?.toLowerCase() ?? null,
		requestedReviewers,
		requestedTeams,
	};
}

function mapGraphQLPullCommits(
	pull: NonNullable<GitHubGraphQLPullPageResponse["repository"]["pullRequest"]>,
): PullCommit[] {
	return (pull.commits.nodes ?? []).flatMap((node) => {
		if (!node) {
			return [];
		}

		return [
			{
				sha: node.commit.oid,
				message: node.commit.message,
				createdAt: node.commit.committedDate,
				author: mapGraphQLActor(
					node.commit.author?.user
						? {
								...node.commit.author.user,
								__typename: "User",
							}
						: null,
				),
			},
		];
	});
}

function mapGraphQLIssueDetail(
	issue: NonNullable<GitHubGraphQLIssuePageResponse["repository"]["issue"]>,
): IssueDetail {
	return {
		id: issue.databaseId ?? 0,
		number: issue.number,
		title: issue.title,
		state: issue.state.toLowerCase(),
		stateReason: issue.stateReason?.toLowerCase() ?? null,
		createdAt: issue.createdAt,
		updatedAt: issue.updatedAt,
		closedAt: issue.closedAt,
		comments: issue.comments.totalCount,
		url: issue.url,
		author: mapGraphQLActor(issue.author),
		labels: mapGraphQLLabels(issue.labels),
		repository: mapGraphQLRepositoryRef(issue.repository),
		body: issue.body,
		assignees: (issue.assignees?.nodes ?? [])
			.map((assignee) => mapGraphQLActor(assignee))
			.filter((assignee): assignee is GitHubActor => Boolean(assignee)),
		milestone: issue.milestone
			? {
					title: issue.milestone.title,
					description: issue.milestone.description,
					dueOn: issue.milestone.dueOn,
				}
			: null,
	};
}

function mapGraphQLRepoOverview(
	repository: NonNullable<GitHubGraphQLRepoOverviewResponse["repository"]>,
): RepoOverview {
	const latestCommitTarget = repository.defaultBranchRef?.target;
	const latestCommit =
		latestCommitTarget?.__typename === "Commit" && latestCommitTarget.oid
			? {
					sha: latestCommitTarget.oid,
					message: latestCommitTarget.message ?? "",
					date: latestCommitTarget.committedDate ?? "",
					author: mapGraphQLActor(
						latestCommitTarget.author?.user
							? {
									...latestCommitTarget.author.user,
									__typename: "User",
								}
							: null,
					),
				}
			: null;

	return {
		id: repository.databaseId ?? 0,
		name: repository.name,
		fullName: repository.nameWithOwner,
		description: repository.description,
		isPrivate: repository.isPrivate,
		isFork: repository.isFork,
		defaultBranch: repository.defaultBranchRef?.name ?? "main",
		stars: repository.stargazerCount,
		forks: repository.forkCount,
		watchers: repository.watchers.totalCount,
		language: repository.primaryLanguage?.name ?? null,
		license: repository.licenseInfo?.spdxId ?? null,
		topics: (repository.repositoryTopics.nodes ?? []).flatMap((node) =>
			node ? [node.topic.name] : [],
		),
		url: repository.url,
		owner: repository.owner.login,
		ownerAvatarUrl: repository.owner.avatarUrl,
		branchCount: repository.branches.totalCount,
		tagCount: repository.tags.totalCount,
		openPullCount: repository.pullRequests.totalCount,
		openIssueCount: repository.issues.totalCount,
		hasDiscussions: repository.hasDiscussionsEnabled,
		latestCommit,
	};
}

function createGraphQLResponseMetadata(
	rateLimit: GitHubGraphQLRateLimit | null | undefined,
) {
	return createGitHubResponseMetadata(200, {
		"x-ratelimit-remaining":
			typeof rateLimit?.remaining === "number"
				? String(rateLimit.remaining)
				: undefined,
		"x-ratelimit-reset": rateLimit?.resetAt
			? String(Math.floor(new Date(rateLimit.resetAt).getTime() / 1_000))
			: undefined,
	});
}

function mergeGraphQLRateLimits(
	rateLimits: Array<GitHubGraphQLRateLimit | null | undefined>,
): GitHubGraphQLRateLimit | null {
	const presentRateLimits = rateLimits.filter(
		(rateLimit): rateLimit is GitHubGraphQLRateLimit => Boolean(rateLimit),
	);
	if (presentRateLimits.length === 0) {
		return null;
	}

	return {
		cost: presentRateLimits.reduce(
			(total, rateLimit) => total + rateLimit.cost,
			0,
		),
		remaining: Math.min(
			...presentRateLimits.map((rateLimit) => rateLimit.remaining),
		),
		resetAt: presentRateLimits
			.map((rateLimit) => rateLimit.resetAt)
			.sort()
			.at(-1) as string,
	};
}

class GitHubOperationTimeoutError extends Error {
	constructor(
		label: string,
		readonly timeoutMs: number,
	) {
		super(`${label} timed out after ${timeoutMs}ms`);
		this.name = "GitHubOperationTimeoutError";
	}
}

/**
 * Module-level tracker for recent GitHub API timeouts.
 * Automatically recorded by `withGitHubOperationTimeout` so that
 * callers that swallow the error (fallback-to-REST, return []) still
 * contribute to the global "GitHub is timing out" signal.
 */
const TIMEOUT_TRACKER_WINDOW_MS = 60_000;
let recentTimeoutTimestamps: number[] = [];

function recordGitHubTimeout() {
	const now = Date.now();
	recentTimeoutTimestamps.push(now);
	recentTimeoutTimestamps = recentTimeoutTimestamps.filter(
		(t) => now - t < TIMEOUT_TRACKER_WINDOW_MS,
	);
}

function hasRecentGitHubTimeouts(): boolean {
	const now = Date.now();
	recentTimeoutTimestamps = recentTimeoutTimestamps.filter(
		(t) => now - t < TIMEOUT_TRACKER_WINDOW_MS,
	);
	return recentTimeoutTimestamps.length > 0;
}

function getRemainingSearchTimeoutMs(deadlineAt: number, maxTimeoutMs: number) {
	return Math.max(0, Math.min(maxTimeoutMs, deadlineAt - Date.now()));
}

async function withGitHubOperationTimeout<T>(
	label: string,
	timeoutMs: number,
	task: (signal: AbortSignal) => Promise<T>,
) {
	if (timeoutMs <= 0) {
		recordGitHubTimeout();
		throw new GitHubOperationTimeoutError(label, timeoutMs);
	}

	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	const taskPromise = task(controller.signal);
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			controller.abort();
			recordGitHubTimeout();
			reject(new GitHubOperationTimeoutError(label, timeoutMs));
		}, timeoutMs);
	});

	try {
		return await Promise.race([taskPromise, timeoutPromise]);
	} finally {
		taskPromise.catch(() => {});
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		controller.abort();
	}
}

async function executeGitHubGraphQL<TResponse>(
	context: GitHubContext,
	label: string,
	query: string,
	variables: Record<string, unknown>,
) {
	return withGitHubOperationTimeout(
		label,
		GITHUB_OPERATION_TIMEOUT_MS,
		(signal) =>
			context.octokit.graphql<TResponse>(query, {
				...variables,
				request: { signal },
			}),
	);
}

/**
 * Extract an organization name from a GitHub FORBIDDEN/OAuth App access
 * restriction error.  Returns `null` when the error is unrelated.
 */
function extractForbiddenOrg(error: unknown): string | null {
	const message = error instanceof Error ? error.message : String(error ?? "");
	if (
		!message.includes("OAuth App access restrictions") &&
		!message.includes("FORBIDDEN")
	) {
		return null;
	}
	const match = message.match(/the `([^`]+)` organization/);
	return match?.[1] ?? null;
}

async function safeCommandPaletteSearch<T>({
	fallback,
	label,
	task,
}: {
	fallback: T;
	label: string;
	task: (signal: AbortSignal) => Promise<T>;
}) {
	try {
		return await withGitHubOperationTimeout(
			`github command search ${label}`,
			GITHUB_OPERATION_TIMEOUT_MS,
			task,
		);
	} catch (error) {
		console.error(`[github-command-search] failed to search ${label}`, error);
		return fallback;
	}
}

const requestScopedGitHubContextCache = new WeakMap<
	Request,
	Map<string, Promise<GitHubContext | null>>
>();

async function getRequestScopedContextCache() {
	try {
		const { getRequest } = await import("@tanstack/react-start/server");
		const request = getRequest();
		let cache = requestScopedGitHubContextCache.get(request);
		if (!cache) {
			cache = new Map();
			requestScopedGitHubContextCache.set(request, cache);
		}
		return cache;
	} catch {
		return null;
	}
}

async function getOrCreateCachedContext(
	cacheKey: string,
	factory: () => Promise<GitHubContext | null>,
): Promise<GitHubContext | null> {
	const cache = await getRequestScopedContextCache();
	const existing = cache?.get(cacheKey);
	if (existing) {
		debug("github-access", "reusing cached context", { cacheKey });
		return existing;
	}

	const promise = factory();
	cache?.set(cacheKey, promise);
	return promise;
}

async function getGitHubContext(): Promise<GitHubContext | null> {
	return getOrCreateCachedContext("base", async () => {
		const { getGitHubClientByUserId, getRequestSession } = await import(
			"./auth-runtime"
		);
		const session = await getRequestSession();
		if (!session) {
			debug("github-access", "no session, unauthenticated request");
			return null;
		}

		debug("github-access", "session found", { userId: session.user.id });
		try {
			return {
				session,
				octokit: await getGitHubClientByUserId(session.user.id),
			};
		} catch (error) {
			console.error("[github-access] failed to create GitHub client", error);
			return null;
		}
	});
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
	try {
		const { getGitHubAppUserClientByUserId } = await import("./auth-runtime");
		const appUserOctokit = await getGitHubAppUserClientByUserId(userId);
		if (!appUserOctokit) {
			debug("github-access", "no app user client, skipping installations");
			return { installations: [], installationsAvailable: false };
		}

		const installationsResponse = await appUserOctokit.request(
			"GET /user/installations",
			{
				per_page: 100,
			},
		);
		const installations = mapGitHubAppInstallations(
			installationsResponse.data as GitHubUserInstallationsPayload,
		);
		debug("github-access", "loaded app installations", {
			count: installations.length,
			owners: installations.map((i) => i.account.login),
		});
		return {
			installations,
			installationsAvailable: true,
		};
	} catch (error) {
		console.error("[github-access] failed to load app installations", error);
		return { installations: [], installationsAvailable: false };
	}
}

async function getGitHubAuthenticatedOrganizations(
	context: GitHubContext,
): Promise<GitHubOrganization[]> {
	try {
		const organizationsResponse = await context.octokit.request(
			"GET /user/orgs",
			{
				per_page: 100,
			},
		);
		const payload =
			organizationsResponse.data as GitHubAuthenticatedOrgPayload[];
		return payload.flatMap((organization) => {
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
		return [];
	}
}

async function getGitHubContextForInstallation(
	baseContext: GitHubContext,
	installation: GitHubAppInstallation,
) {
	return getOrCreateCachedContext(
		`installation:${installation.id}`,
		async () => {
			if (installation.suspendedAt) {
				return null;
			}

			try {
				debug("github-access", "creating installation client", {
					owner: installation.account.login,
					installationId: installation.id,
				});
				const { getGitHubInstallationClient } = await import("./github.server");
				const installationOctokit = await getGitHubInstallationClient(
					installation.id,
				);
				// Eagerly authenticate to verify the installation token is valid.
				// auth-app authenticates lazily by default, so without this the
				// try/catch cannot catch auth failures.
				await installationOctokit.auth({ type: "installation" });
				debug("github-access", "installation client ready", {
					owner: installation.account.login,
				});
				return {
					...baseContext,
					octokit: installationOctokit,
				};
			} catch (error) {
				console.error(
					"[github-access] installation client failed",
					installation.account.login,
					error,
				);
				return null;
			}
		},
	);
}

async function getGitHubContextForOwner(owner: string) {
	return getOrCreateCachedContext(`owner:${owner}`, async () => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		const { installations } = await getGitHubAppUserInstallations(
			context.session.user.id,
		);
		const installation = findGitHubAppInstallationForOwner(
			installations,
			owner,
		);
		if (!installation) {
			debug("github-access", "no installation for owner, using OAuth token", {
				owner,
			});
			return context;
		}

		const installationContext = await getGitHubContextForInstallation(
			context,
			installation,
		);
		if (!installationContext) {
			console.error(
				"[github-access] installation client failed, falling back to OAuth token",
				owner,
			);
			return context;
		}

		return installationContext;
	});
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
			!candidate.suspendedAt &&
			(candidate.account.login.toLowerCase() === normalizedOwner ||
				(candidate.targetType === "User" &&
					candidate.account.login.toLowerCase() === normalizedOwner)),
	);
}

async function getGitHubUserContextForOwner(owner: string) {
	return getOrCreateCachedContext(`user-owner:${owner}`, async () => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		try {
			const { getGitHubAppUserClientByUserId } = await import("./auth-runtime");
			const appUserOctokit = await getGitHubAppUserClientByUserId(
				context.session.user.id,
			);
			if (!appUserOctokit) {
				debug(
					"github-access",
					"no app user client for writes, using OAuth token",
					{ owner },
				);
				return context;
			}

			const { installations } = await getGitHubAppUserInstallations(
				context.session.user.id,
			);
			const installation = findGitHubAppInstallationForOwner(
				installations,
				owner,
			);
			if (!installation) {
				debug(
					"github-access",
					"no installation for owner, using OAuth token for writes",
					{ owner },
				);
				return context;
			}

			debug("github-access", "using app user token for writes", { owner });
			return {
				...context,
				octokit: appUserOctokit,
			};
		} catch (error) {
			console.error(
				"[github-access] failed to resolve user context, falling back to OAuth token",
				owner,
				error,
			);
			return context;
		}
	});
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
		signal: AbortSignal,
	) => Promise<GitHubRestResponse<TData>>,
	conditionals: GitHubConditionalHeaders,
	label = "github request",
): Promise<GitHubFetchResult<TData>> {
	try {
		const response = await withGitHubOperationTimeout(
			label,
			GITHUB_OPERATION_TIMEOUT_MS,
			(signal) => request(buildConditionalHeaders(conditionals), signal),
		);

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
		signal: AbortSignal,
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
			const result = await executeGitHubRequest(
				request,
				conditionals,
				`github ${resource}`,
			);

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
	request: (
		page: number,
		signal: AbortSignal,
	) => Promise<GitHubRestResponse<TGitHubItem[]>>;
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
			const deadlineAt = Date.now() + GITHUB_PAGINATED_OPERATION_TIMEOUT_MS;

			while (true) {
				const timeoutMs = getRemainingSearchTimeoutMs(
					deadlineAt,
					GITHUB_OPERATION_TIMEOUT_MS,
				);
				if (timeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
					throw new GitHubOperationTimeoutError(
						`github ${resource} page ${page}`,
						timeoutMs,
					);
				}

				const response = await withGitHubOperationTimeout(
					`github ${resource} page ${page}`,
					timeoutMs,
					(signal) => request(page, signal),
				);
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
	label = "github paginated items",
	pageSize = 100,
}: {
	request: (
		page: number,
		signal: AbortSignal,
	) => Promise<GitHubRestResponse<unknown>>;
	getItems: (data: unknown) => TItem[];
	label?: string;
	pageSize?: number;
}) {
	const items: TItem[] = [];
	let page = 1;
	const deadlineAt = Date.now() + GITHUB_PAGINATED_OPERATION_TIMEOUT_MS;

	while (true) {
		const timeoutMs = getRemainingSearchTimeoutMs(
			deadlineAt,
			GITHUB_OPERATION_TIMEOUT_MS,
		);
		if (timeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
			throw new GitHubOperationTimeoutError(`${label} page ${page}`, timeoutMs);
		}

		const response = await withGitHubOperationTimeout(
			`${label} page ${page}`,
			timeoutMs,
			(signal) => request(page, signal),
		);
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
			const bots = await withGitHubOperationTimeout(
				`github reviewer bots ${params.owner}/${params.repo}`,
				GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
				async () => {
					const installations = await listReviewerBotInstallations(
						context,
						params,
					);
					const matchingInstallations: GitHubReviewerBotInstallationPayload[] =
						[];
					const ownAppSlug = getGitHubAppSlug();

					for (const installation of installations) {
						if (
							installation.app_slug !== ownAppSlug &&
							installationCanReviewPullRequests(installation) &&
							(await installationHasRepositoryAccess(
								context,
								installation,
								params,
							))
						) {
							matchingInstallations.push(installation);
						}
					}

					return (
						await Promise.all(
							matchingInstallations.map((installation) =>
								mapReviewerBotInstallation(context, installation),
							),
						)
					).filter((candidate): candidate is RepoCollaborator =>
						Boolean(candidate),
					);
				},
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
	"head_ref_deleted",
	"head_ref_restored",
]);

function mapTimelineEvents(rawEvents: unknown[]): TimelineEvent[] {
	return rawEvents
		.filter((e) => {
			const event = (e as Record<string, unknown>).event as string | undefined;
			return event && TIMELINE_EVENT_TYPES.has(event);
		})
		.map((e) => {
			const raw = e as Record<string, unknown>;
			// "reviewed" events use `user` instead of `actor`
			const actor = (raw.actor ?? raw.user) as
				| Record<string, unknown>
				| null
				| undefined;
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
				createdAt:
					(raw.created_at as string) ?? (raw.submitted_at as string) ?? "",
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

function deriveHeadRefDeleted(events: TimelineEvent[]): boolean {
	for (let i = events.length - 1; i >= 0; i--) {
		if (events[i].event === "head_ref_restored") return false;
		if (events[i].event === "head_ref_deleted") return true;
	}
	return false;
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
		const response = await executeGitHubGraphQL<GraphQLCrossRefResponse>(
			context,
			`github cross references ${data.owner}/${data.repo}#${data.issueNumber}`,
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

	const allCheckRuns = checksResponse?.data.check_runs ?? [];

	// Deduplicate by name — keep the most recent run (highest id) per check name
	const latestByName = new Map<string, (typeof allCheckRuns)[number]>();
	for (const check of allCheckRuns) {
		const existing = latestByName.get(check.name);
		if (!existing || check.id > existing.id) {
			latestByName.set(check.name, check);
		}
	}
	const checkRuns = Array.from(latestByName.values());

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
	let conflictingFiles: string[] = [];
	const hasConflicts =
		pull.mergeable_state === "dirty" || pull.mergeable === false;
	try {
		const [comparison, prFiles] = await Promise.all([
			context.octokit.rest.repos.compareCommits({
				owner: data.owner,
				repo: data.repo,
				base: pull.head.sha,
				head: pull.base.ref,
			}),
			hasConflicts
				? context.octokit.rest.pulls
						.listFiles({
							owner: data.owner,
							repo: data.repo,
							pull_number: data.pullNumber,
							per_page: 100,
						})
						.catch(() => null)
				: null,
		]);
		behindBy = comparison.data.ahead_by;

		if (hasConflicts && prFiles && comparison.data.files) {
			const baseChangedFiles = new Set(
				comparison.data.files.map((f) => f.filename),
			);
			conflictingFiles = prFiles.data
				.map((f) => f.filename)
				.filter((f) => baseChangedFiles.has(f));
		}
	} catch {
		behindBy = null;
	}

	const viewer = await getViewer(userContext ?? context);
	const isViewerAuthor = pull.user?.login === viewer.login;
	const canUpdateBranch =
		isViewerAuthor ||
		!permissions ||
		permissions.push === true ||
		permissions.admin === true;
	const canMerge =
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
		conflictingFiles,
		behindBy,
		baseRefName: pull.base.ref,
		canUpdateBranch,
		canBypassProtections,
		canMerge,
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
				data: await withGitHubOperationTimeout(
					`github pull status ${data.owner}/${data.repo}#${data.pullNumber}`,
					GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
					() => computePullStatus(context, data, pullForStatus),
				),
				metadata: createGitHubResponseMetadata(200, {}),
			};
		},
	});
}

async function getPullPageDataViaGraphQL(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	const pullNamespaceKey = githubRevalidationSignalKeys.pullEntity({
		owner: data.owner,
		repo: data.repo,
		pullNumber: data.pullNumber,
	});

	return getOrRevalidateGitHubResource<PullPageData>({
		userId: context.session.user.id,
		resource: "pulls.pageData.graphql.v1",
		params: data,
		freshForMs: githubCachePolicy.detail.staleTimeMs,
		signalKeys: [pullNamespaceKey],
		namespaceKeys: [pullNamespaceKey],
		cacheMode: "split",
		fetcher: async () => {
			const [response, timelineResult] = await Promise.all([
				executeGitHubGraphQL<GitHubGraphQLPullPageResponse>(
					context,
					`github pull page ${data.owner}/${data.repo}#${data.pullNumber}`,
					`query($owner: String!, $repo: String!, $number: Int!) {
						repository(owner: $owner, name: $repo) {
							pullRequest(number: $number) {
								databaseId
								number
								title
								state
								isDraft
								createdAt
								updatedAt
								closedAt
								mergedAt
								url
								body
								additions
								deletions
								changedFiles
								comments { totalCount }
								author { __typename login avatarUrl url }
								labels(first: 20) {
									nodes { name color description }
								}
								headRefName
								headRefOid
								headRepositoryOwner { login }
								baseRefName
								merged
								mergeCommit { oid }
								mergedBy { __typename login avatarUrl url }
								mergeable
								mergeStateStatus
								repository {
									name
									nameWithOwner
									url
									owner { login }
								}
								reviewThreads(first: 1) { totalCount }
								reviewRequests(first: 100) {
									nodes {
										requestedReviewer {
											__typename
											... on User {
												login
												avatarUrl
												url
											}
											... on Team {
												name
												slug
												url
											}
										}
									}
								}
								commits(first: 100) {
									totalCount
									nodes {
										commit {
											oid
											message
											committedDate
											author {
												user {
													login
													avatarUrl
													url
												}
											}
										}
									}
								}
								firstComments: comments(first: 30) {
									totalCount
									nodes {
										id
										databaseId
										body
										createdAt
										author { __typename login avatarUrl url }
									}
								}
								lastComments: comments(last: 30) {
									totalCount
									nodes {
										id
										databaseId
										body
										createdAt
										author { __typename login avatarUrl url }
									}
								}
							}
						}
						rateLimit {
							cost
							remaining
							resetAt
						}
					}`,
					{
						owner: data.owner,
						repo: data.repo,
						number: data.pullNumber,
					},
				),
				getTimelineEventsResult(context, {
					owner: data.owner,
					repo: data.repo,
					issueNumber: data.pullNumber,
				}),
			]);

			const pull = response.repository.pullRequest;
			if (!pull) {
				throw new Error(
					`Pull request not found: ${data.owner}/${data.repo}#${data.pullNumber}`,
				);
			}

			const totalComments = pull.comments.totalCount;
			const loadedPages = getLoadedCommentPages(totalComments);
			const detail = mapGraphQLPullDetail(pull);
			const events = timelineResult.events;

			return {
				kind: "success",
				data: {
					detail,
					comments: mapGraphQLComments(pull.firstComments, pull.lastComments),
					commits: mapGraphQLPullCommits(pull),
					events,
					commentPagination: {
						totalCount: totalComments,
						perPage: COMMENTS_PER_PAGE,
						loadedPages,
					},
					eventPagination: {
						loadedPages: [1],
						hasMore: timelineResult.hasMore,
					},
					headRefDeleted: deriveHeadRefDeleted(events),
				},
				metadata: createGraphQLResponseMetadata(response.rateLimit),
			};
		},
	});
}

async function getPullPageDataViaRest(
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
		headRefDeleted: deriveHeadRefDeleted(timelineResult.events),
	};
}

async function getPullPageDataResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullPageData> {
	try {
		return await getPullPageDataViaGraphQL(context, data);
	} catch (error) {
		console.error("[pull-page:gql] failed, falling back to REST", error);
		return getPullPageDataViaRest(context, data);
	}
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

async function getIssuePageDataViaGraphQL(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssuePageData> {
	const issueNamespaceKey = githubRevalidationSignalKeys.issueEntity({
		owner: data.owner,
		repo: data.repo,
		issueNumber: data.issueNumber,
	});

	return getOrRevalidateGitHubResource<IssuePageData>({
		userId: context.session.user.id,
		resource: "issues.pageData.graphql.v1",
		params: data,
		freshForMs: githubCachePolicy.detail.staleTimeMs,
		signalKeys: [issueNamespaceKey],
		namespaceKeys: [issueNamespaceKey],
		cacheMode: "split",
		fetcher: async () => {
			const [response, timelineResult] = await Promise.all([
				executeGitHubGraphQL<GitHubGraphQLIssuePageResponse>(
					context,
					`github issue page ${data.owner}/${data.repo}#${data.issueNumber}`,
					`query($owner: String!, $repo: String!, $number: Int!) {
						repository(owner: $owner, name: $repo) {
							issue(number: $number) {
								databaseId
								number
								title
								state
								stateReason
								createdAt
								updatedAt
								closedAt
								url
								body
								comments { totalCount }
								author { __typename login avatarUrl url }
								labels(first: 20) {
									nodes { name color description }
								}
								repository {
									name
									nameWithOwner
									url
									owner { login }
								}
								assignees(first: 20) {
									nodes {
										__typename
										login
										avatarUrl
										url
									}
								}
								milestone {
									title
									description
									dueOn
								}
								firstComments: comments(first: 30) {
									totalCount
									nodes {
										id
										databaseId
										body
										createdAt
										author { __typename login avatarUrl url }
									}
								}
								lastComments: comments(last: 30) {
									totalCount
									nodes {
										id
										databaseId
										body
										createdAt
										author { __typename login avatarUrl url }
									}
								}
							}
						}
						rateLimit {
							cost
							remaining
							resetAt
						}
					}`,
					{
						owner: data.owner,
						repo: data.repo,
						number: data.issueNumber,
					},
				),
				getTimelineEventsResult(context, {
					owner: data.owner,
					repo: data.repo,
					issueNumber: data.issueNumber,
				}),
			]);

			const issue = response.repository.issue;
			if (!issue) {
				throw new Error(
					`Issue not found: ${data.owner}/${data.repo}#${data.issueNumber}`,
				);
			}

			const totalComments = issue.comments.totalCount;

			return {
				kind: "success",
				data: {
					detail: mapGraphQLIssueDetail(issue),
					comments: mapGraphQLComments(issue.firstComments, issue.lastComments),
					events: timelineResult.events,
					commentPagination: {
						totalCount: totalComments,
						perPage: COMMENTS_PER_PAGE,
						loadedPages: getLoadedCommentPages(totalComments),
					},
					eventPagination: {
						loadedPages: [1],
						hasMore: timelineResult.hasMore,
					},
				},
				metadata: createGraphQLResponseMetadata(response.rateLimit),
			};
		},
	});
}

async function getIssuePageDataViaRest(
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

async function getIssuePageDataResult(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssuePageData> {
	try {
		return await getIssuePageDataViaGraphQL(context, data);
	} catch (error) {
		console.error("[issue-page:gql] failed, falling back to REST", error);
		return getIssuePageDataViaRest(context, data);
	}
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

type GraphQLMyPullsResponse = {
	reviewRequested: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	assigned: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	authored: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	mentioned: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	involved: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	rateLimit: GitHubGraphQLRateLimit;
};

type GraphQLMyIssuesResponse = {
	assigned: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	authored: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	mentioned: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	rateLimit: GitHubGraphQLRateLimit;
};

function mapGraphQLPullSearchConnection(
	connection: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>,
) {
	return (connection.nodes ?? [])
		.map((node) => mapGraphQLPullSearchNode(node))
		.filter((item): item is PullSummary => Boolean(item));
}

function mapGraphQLIssueSearchConnection(
	connection: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>,
) {
	return (connection.nodes ?? [])
		.map((node) => mapGraphQLIssueSearchNode(node))
		.filter((item): item is IssueSummary => Boolean(item));
}

function ownerScopeKey(scope: GitHubSearchOwnerScope) {
	return `${scope.targetType}:${normalizeLogin(scope.login)}`;
}

function toSearchOwnerScope(
	installation: GitHubAppInstallation,
): GitHubSearchOwnerScope | null {
	if (
		installation.suspendedAt ||
		(installation.targetType !== "Organization" &&
			installation.targetType !== "User")
	) {
		return null;
	}

	return {
		login: installation.account.login,
		targetType: installation.targetType,
	};
}

function addExcludedOwnerScope(
	excludedOwners: Map<string, GitHubSearchOwnerScope>,
	scope: GitHubSearchOwnerScope,
) {
	excludedOwners.set(ownerScopeKey(scope), scope);
}

async function getMySearchSources(
	context: GitHubContext,
	viewerLogin: string,
	deadlineAt: number,
): Promise<GitHubGraphQLSearchSource[]> {
	let installations: GitHubAppInstallation[] = [];
	try {
		const installationResult = await withGitHubOperationTimeout(
			"github search source discovery",
			getRemainingSearchTimeoutMs(deadlineAt, MY_SEARCH_SOURCE_TIMEOUT_MS),
			() => getGitHubAppUserInstallations(context.session.user.id),
		);
		installations = installationResult.installations;
	} catch (error) {
		console.error("[github-search] failed to discover search sources", error);
	}

	const sources: GitHubGraphQLSearchSource[] = [];
	const excludedOAuthOwners = new Map<string, GitHubSearchOwnerScope>();

	for (const installation of installations) {
		const owner = toSearchOwnerScope(installation);
		if (!owner) {
			continue;
		}

		const contextTimeoutMs = getRemainingSearchTimeoutMs(
			deadlineAt,
			MY_SEARCH_SOURCE_TIMEOUT_MS,
		);
		if (contextTimeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
			debug("github-search", "skipping remaining installations, deadline low", {
				remainingMs: contextTimeoutMs,
			});
			break;
		}

		const installationContext = await withGitHubOperationTimeout(
			`github installation context ${installation.id}`,
			contextTimeoutMs,
			() => getGitHubContextForInstallation(context, installation),
		).catch((error) => {
			console.error(
				"[github-search] failed to create installation source",
				installation.account.login,
				error,
			);
			return null;
		});
		if (!installationContext) {
			continue;
		}

		if (owner.targetType === "Organization") {
			addExcludedOwnerScope(excludedOAuthOwners, owner);
		}
		if (
			owner.targetType === "User" &&
			installation.repositorySelection === "all" &&
			normalizeLogin(owner.login) === normalizeLogin(viewerLogin)
		) {
			addExcludedOwnerScope(excludedOAuthOwners, owner);
		}

		sources.push({
			label: `installation:${installation.id}:${owner.login}`,
			context: installationContext,
			owner,
		});
	}

	sources.push({
		label: "oauth:fallback",
		context,
		excludeOwners: [...excludedOAuthOwners.values()],
	});

	return sources;
}

function mergeSearchBuckets<
	TItem extends {
		number: number;
		updatedAt: string;
		repository: RepositoryRef;
	},
>(buckets: TItem[][]) {
	const byKey = new Map<string, TItem>();

	for (const bucket of buckets) {
		for (const item of bucket) {
			const key = `${normalizeLogin(item.repository.fullName)}#${item.number}`;
			const existing = byKey.get(key);
			if (
				!existing ||
				Date.parse(item.updatedAt) > Date.parse(existing.updatedAt)
			) {
				byKey.set(key, item);
			}
		}
	}

	return [...byKey.values()]
		.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
		.slice(0, MY_SEARCH_BUCKET_LIMIT);
}

function mergeMyPullsResults(results: MyPullsResult[]): MyPullsResult {
	return {
		reviewRequested: mergeSearchBuckets(
			results.map((result) => result.reviewRequested),
		),
		assigned: mergeSearchBuckets(results.map((result) => result.assigned)),
		authored: mergeSearchBuckets(results.map((result) => result.authored)),
		mentioned: mergeSearchBuckets(results.map((result) => result.mentioned)),
		involved: mergeSearchBuckets(results.map((result) => result.involved)),
	};
}

function mergeMyIssuesResults(results: MyIssuesResult[]): MyIssuesResult {
	return {
		assigned: mergeSearchBuckets(results.map((result) => result.assigned)),
		authored: mergeSearchBuckets(results.map((result) => result.authored)),
		mentioned: mergeSearchBuckets(results.map((result) => result.mentioned)),
	};
}

function buildSourceSearchQuery({
	itemType,
	role,
	source,
	username,
}: {
	itemType: "issue" | "pr";
	role: IssueSearchRole | PullSearchRole;
	source: GitHubGraphQLSearchSource;
	username: string;
}) {
	return buildUserSearchQuery({
		itemType,
		role,
		state: "open",
		username,
		owner: source.owner?.login,
		ownerType: source.owner?.targetType,
		excludeOwners: source.excludeOwners,
	});
}

async function getMyPullsResult({
	context,
	username,
}: {
	context: GitHubContext;
	username: string;
}) {
	return getOrRevalidateGitHubResource<MyPullsResult>({
		userId: context.session.user.id,
		resource: "pulls.mine.graphql.v2",
		params: { username },
		freshForMs: githubCachePolicy.list.staleTimeMs,
		signalKeys: [githubRevalidationSignalKeys.pullsMine],
		namespaceKeys: [githubRevalidationSignalKeys.pullsMine],
		cacheMode: "split",
		merge: (existing, fresh) => mergeMyPullsResults([existing, fresh]),
		fetcher: async () => {
			const deadlineAt = Date.now() + MY_SEARCH_TOTAL_TIMEOUT_MS;
			const sources = await getMySearchSources(context, username, deadlineAt);
			const results: MyPullsResult[] = [];
			const rateLimits: GitHubGraphQLRateLimit[] = [];
			const forbiddenOrgs: string[] = [];
			let timedOut = false;

			for (const source of sources) {
				const sourceTimeoutMs = getRemainingSearchTimeoutMs(
					deadlineAt,
					MY_SEARCH_SOURCE_TIMEOUT_MS,
				);
				if (sourceTimeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
					debug("github-search", "stopping pull search, deadline low", {
						remainingMs: sourceTimeoutMs,
					});
					break;
				}

				try {
					const response = await withGitHubOperationTimeout(
						`github pull search ${source.label}`,
						sourceTimeoutMs,
						(signal) =>
							source.context.octokit.graphql<GraphQLMyPullsResponse>(
								`query(
								$reviewRequestedQuery: String!
								$assignedQuery: String!
								$authoredQuery: String!
								$mentionedQuery: String!
								$involvedQuery: String!
							) {
								reviewRequested: search(type: ISSUE, first: 30, query: $reviewRequestedQuery) {
									nodes { ...PullSearchFields }
								}
								assigned: search(type: ISSUE, first: 30, query: $assignedQuery) {
									nodes { ...PullSearchFields }
								}
								authored: search(type: ISSUE, first: 30, query: $authoredQuery) {
									nodes { ...PullSearchFields }
								}
								mentioned: search(type: ISSUE, first: 30, query: $mentionedQuery) {
									nodes { ...PullSearchFields }
								}
								involved: search(type: ISSUE, first: 30, query: $involvedQuery) {
									nodes { ...PullSearchFields }
								}
								rateLimit {
									cost
									remaining
									resetAt
								}
							}

							fragment PullSearchFields on PullRequest {
								__typename
								databaseId
								number
								title
								state
								isDraft
								createdAt
								updatedAt
								closedAt
								mergedAt
								url
								comments {
									totalCount
								}
								author {
									__typename
									login
									avatarUrl
									url
								}
								labels(first: 20) {
									nodes {
										name
										color
										description
									}
								}
								repository {
									name
									nameWithOwner
									url
									owner {
										login
									}
								}
							}`,
								{
									reviewRequestedQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "review-requested",
										source,
										username,
									}),
									assignedQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "assigned",
										source,
										username,
									}),
									authoredQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "author",
										source,
										username,
									}),
									mentionedQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "mentioned",
										source,
										username,
									}),
									involvedQuery: buildSourceSearchQuery({
										itemType: "pr",
										role: "involved",
										source,
										username,
									}),
									request: { signal },
								},
							),
					);

					results.push({
						reviewRequested: mapGraphQLPullSearchConnection(
							response.reviewRequested,
						),
						assigned: mapGraphQLPullSearchConnection(response.assigned),
						authored: mapGraphQLPullSearchConnection(response.authored),
						mentioned: mapGraphQLPullSearchConnection(response.mentioned),
						involved: mapGraphQLPullSearchConnection(response.involved),
					});
					rateLimits.push(response.rateLimit);
				} catch (error) {
					console.error(
						"[github-search] failed to load pull requests",
						source.label,
						error,
					);
					if (error instanceof GitHubOperationTimeoutError) {
						timedOut = true;
					}
					const org = extractForbiddenOrg(error);
					if (org) forbiddenOrgs.push(org);
				}
			}

			const data = mergeMyPullsResults(results);
			if (forbiddenOrgs.length > 0) {
				data.forbiddenOrgs = [...new Set(forbiddenOrgs)];
			}
			if (timedOut || hasRecentGitHubTimeouts()) {
				data.timedOut = true;
			}

			return {
				kind: "success",
				data,
				metadata: createGraphQLResponseMetadata(
					mergeGraphQLRateLimits(rateLimits),
				),
			};
		},
	});
}

async function getMyIssuesResult({
	context,
	username,
}: {
	context: GitHubContext;
	username: string;
}) {
	return getOrRevalidateGitHubResource<MyIssuesResult>({
		userId: context.session.user.id,
		resource: "issues.mine.graphql.v2",
		params: { username },
		freshForMs: githubCachePolicy.list.staleTimeMs,
		signalKeys: [githubRevalidationSignalKeys.issuesMine],
		namespaceKeys: [githubRevalidationSignalKeys.issuesMine],
		cacheMode: "split",
		merge: (existing, fresh) => mergeMyIssuesResults([existing, fresh]),
		fetcher: async () => {
			const deadlineAt = Date.now() + MY_SEARCH_TOTAL_TIMEOUT_MS;
			const sources = await getMySearchSources(context, username, deadlineAt);
			const results: MyIssuesResult[] = [];
			const rateLimits: GitHubGraphQLRateLimit[] = [];
			const forbiddenOrgs: string[] = [];
			let timedOut = false;

			for (const source of sources) {
				const sourceTimeoutMs = getRemainingSearchTimeoutMs(
					deadlineAt,
					MY_SEARCH_SOURCE_TIMEOUT_MS,
				);
				if (sourceTimeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
					debug("github-search", "stopping issue search, deadline low", {
						remainingMs: sourceTimeoutMs,
					});
					break;
				}

				try {
					const response = await withGitHubOperationTimeout(
						`github issue search ${source.label}`,
						sourceTimeoutMs,
						(signal) =>
							source.context.octokit.graphql<GraphQLMyIssuesResponse>(
								`query(
								$assignedQuery: String!
								$authoredQuery: String!
								$mentionedQuery: String!
							) {
								assigned: search(type: ISSUE, first: 30, query: $assignedQuery) {
									nodes { ...IssueSearchFields }
								}
								authored: search(type: ISSUE, first: 30, query: $authoredQuery) {
									nodes { ...IssueSearchFields }
								}
								mentioned: search(type: ISSUE, first: 30, query: $mentionedQuery) {
									nodes { ...IssueSearchFields }
								}
								rateLimit {
									cost
									remaining
									resetAt
								}
							}

							fragment IssueSearchFields on Issue {
								__typename
								databaseId
								number
								title
								state
								stateReason
								createdAt
								updatedAt
								closedAt
								url
								comments {
									totalCount
								}
								author {
									__typename
									login
									avatarUrl
									url
								}
								labels(first: 20) {
									nodes {
										name
										color
										description
									}
								}
								repository {
									name
									nameWithOwner
									url
									owner {
										login
									}
								}
							}`,
								{
									assignedQuery: buildSourceSearchQuery({
										itemType: "issue",
										role: "assigned",
										source,
										username,
									}),
									authoredQuery: buildSourceSearchQuery({
										itemType: "issue",
										role: "author",
										source,
										username,
									}),
									mentionedQuery: buildSourceSearchQuery({
										itemType: "issue",
										role: "mentioned",
										source,
										username,
									}),
									request: { signal },
								},
							),
					);

					results.push({
						assigned: mapGraphQLIssueSearchConnection(response.assigned),
						authored: mapGraphQLIssueSearchConnection(response.authored),
						mentioned: mapGraphQLIssueSearchConnection(response.mentioned),
					});
					rateLimits.push(response.rateLimit);
				} catch (error) {
					console.error(
						"[github-search] failed to load issues",
						source.label,
						error,
					);
					if (error instanceof GitHubOperationTimeoutError) {
						timedOut = true;
					}
					const org = extractForbiddenOrg(error);
					if (org) forbiddenOrgs.push(org);
				}
			}

			const data = mergeMyIssuesResults(results);
			if (forbiddenOrgs.length > 0) {
				data.forbiddenOrgs = [...new Set(forbiddenOrgs)];
			}
			if (timedOut || hasRecentGitHubTimeouts()) {
				data.timedOut = true;
			}

			return {
				kind: "success",
				data,
				metadata: createGraphQLResponseMetadata(
					mergeGraphQLRateLimits(rateLimits),
				),
			};
		},
	});
}

function identityValidator<TInput>(data: TInput) {
	return data;
}

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

export const checkSetupComplete = createServerFn({
	method: "GET",
}).handler(async (): Promise<boolean> => {
	const { getRequestSession } = await import("./auth-runtime");
	const session = await getRequestSession();
	if (!session) {
		return false;
	}

	const { hasGitHubAppUserAccount } = await import("./github-app.server");
	return hasGitHubAppUserAccount(session.user.id);
});

export const getGitHubAppAccessState = createServerFn({
	method: "GET",
}).handler(async (): Promise<GitHubAppAccessState | null> => {
	const context = await getGitHubContext();
	if (!context) {
		return null;
	}

	const viewer = await withGitHubOperationTimeout(
		"github app access viewer",
		GITHUB_OPERATION_TIMEOUT_MS,
		() => getViewer(context),
	);
	const appSlug = getGitHubAppSlug();
	const appAuthorizationUrl = buildGitHubAppAuthorizePath();
	const publicInstallUrl = buildGitHubAppInstallUrl(appSlug);
	const [
		{ installations, installationsAvailable },
		authenticatedOrganizations,
	] = await withGitHubOperationTimeout(
		"github app access state",
		GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
		() =>
			Promise.all([
				getGitHubAppUserInstallations(context.session.user.id),
				getGitHubAuthenticatedOrganizations(context),
			]),
	);

	let organizations = authenticatedOrganizations;

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

		const viewer = await getViewer(context);
		const login = viewer.login;

		const perPage = clampCommandSearchPerPage(data.perPage);
		const [pullItems, issueItems] = await Promise.all([
			safeCommandPaletteSearch({
				label: "pull requests",
				fallback: [] as SearchItem[],
				task: async (signal) => {
					const response =
						await context.octokit.rest.search.issuesAndPullRequests({
							q: `${query} is:pr involves:${login} archived:false`,
							per_page: perPage,
							sort: "updated",
							order: "desc",
							request: { signal },
						});
					return response.data.items;
				},
			}),
			safeCommandPaletteSearch({
				label: "issues",
				fallback: [] as SearchItem[],
				task: async (signal) => {
					const response =
						await context.octokit.rest.search.issuesAndPullRequests({
							q: `${query} is:issue involves:${login} archived:false`,
							per_page: perPage,
							sort: "updated",
							order: "desc",
							request: { signal },
						});
					return response.data.items;
				},
			}),
		]);

		return {
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
		return getMyPullsResult({ context, username: viewer.login });
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
		return getMyIssuesResult({ context, username: viewer.login });
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
		const context = await getGitHubUserContextForRepository(data);
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

type UpdatePullStateInput = PullFromRepoInput & {
	state: "open" | "closed";
};

export const updatePullState = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<UpdatePullStateInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.update({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				state: data.state,
			});
			await bustPullDetailCaches(context.session.user.id, data);
			return { ok: true };
		} catch (error) {
			return toMutationError(
				`${data.state === "closed" ? "close" : "reopen"} pull request`,
				error,
			);
		}
	});

export const updatePullBranch = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
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
	commitTitle?: string;
	commitMessage?: string;
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
				...(data.commitTitle && { commit_title: data.commitTitle }),
				...(data.commitMessage && { commit_message: data.commitMessage }),
			});
			await bustPullDetailCaches(context.session.user.id, data);
			return { ok: true };
		} catch (error) {
			return toMutationError("merge pull request", error);
		}
	});

export const deleteBranch = createServerFn({ method: "POST" })
	.inputValidator(
		identityValidator<{
			owner: string;
			repo: string;
			branch: string;
			pullNumber: number;
		}>,
	)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.git.deleteRef({
				owner: data.owner,
				repo: data.repo,
				ref: `heads/${data.branch}`,
			});
			await bustPullDetailCaches(context.session.user.id, data);
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
				nodeId: comment.node_id,
				pullRequestReviewId: comment.pull_request_review_id ?? null,
				body: comment.body,
				path: comment.path,
				line: comment.line ?? null,
				startLine: comment.start_line ?? null,
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

// ── Get review thread resolution statuses ────────────────────────

type GraphQLReviewThread = {
	id: string;
	isResolved: boolean;
	comments: {
		nodes: Array<{ databaseId: number }>;
	};
};

type GraphQLReviewThreadsResponse = {
	repository: {
		pullRequest: {
			reviewThreads: {
				nodes: GraphQLReviewThread[];
				pageInfo: { hasNextPage: boolean; endCursor: string | null };
			};
		};
	};
};

export const getReviewThreadStatuses = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<ReviewThreadInfo[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];

		try {
			const threads: ReviewThreadInfo[] = [];
			let cursor: string | null = null;
			let hasNext = true;

			while (hasNext) {
				const response: GraphQLReviewThreadsResponse =
					await context.octokit.graphql<GraphQLReviewThreadsResponse>(
						`query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
							repository(owner: $owner, name: $repo) {
								pullRequest(number: $number) {
									reviewThreads(first: 100, after: $cursor) {
										nodes {
											id
											isResolved
											comments(first: 1) {
												nodes { databaseId }
											}
										}
										pageInfo { hasNextPage endCursor }
									}
								}
							}
						}`,
						{
							owner: data.owner,
							repo: data.repo,
							number: data.pullNumber,
							cursor,
						},
					);

				const page = response.repository.pullRequest.reviewThreads;
				for (const thread of page.nodes) {
					const firstCommentId = thread.comments.nodes[0]?.databaseId;
					if (firstCommentId != null) {
						threads.push({
							threadId: thread.id,
							isResolved: thread.isResolved,
							firstCommentId,
						});
					}
				}

				hasNext = page.pageInfo.hasNextPage;
				cursor = page.pageInfo.endCursor;
			}

			return threads;
		} catch {
			return [];
		}
	});

// ── Resolve / unresolve review thread ────────────────────────────

export type ResolveThreadInput = {
	owner: string;
	repo: string;
	threadId: string;
};

export const resolveReviewThread = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<ResolveThreadInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.graphql(
				`mutation($threadId: ID!) {
					resolveReviewThread(input: { threadId: $threadId }) {
						thread { isResolved }
					}
				}`,
				{ threadId: data.threadId },
			);
			return { ok: true };
		} catch (error) {
			return toMutationError("resolve thread", error);
		}
	});

export const unresolveReviewThread = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<ResolveThreadInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.graphql(
				`mutation($threadId: ID!) {
					unresolveReviewThread(input: { threadId: $threadId }) {
						thread { isResolved }
					}
				}`,
				{ threadId: data.threadId },
			);
			return { ok: true };
		} catch (error) {
			return toMutationError("unresolve thread", error);
		}
	});

export const submitPullReview = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<SubmitReviewInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubUserContextForRepository(data);
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
		} catch (error) {
			console.error("[submitPullReview] Failed:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(message);
		}
	});

export const createReviewComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<CreateReviewCommentInput>)
	.handler(async ({ data }): Promise<PullReviewComment | null> => {
		const context = await getGitHubUserContextForRepository(data);
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
				nodeId: comment.node_id,
				pullRequestReviewId: comment.pull_request_review_id ?? null,
				body: comment.body,
				path: comment.path,
				line: comment.line ?? null,
				startLine: comment.start_line ?? null,
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

export const replyToReviewComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<ReplyToReviewCommentInput>)
	.handler(async ({ data }): Promise<PullReviewComment | null> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return null;
		}

		try {
			const response =
				await context.octokit.rest.pulls.createReplyForReviewComment({
					owner: data.owner,
					repo: data.repo,
					pull_number: data.pullNumber,
					comment_id: data.commentId,
					body: data.body,
				});

			const comment = response.data;
			await bustPullReviewCaches(context.session.user.id, {
				owner: data.owner,
				repo: data.repo,
				pullNumber: data.pullNumber,
			});

			return {
				id: comment.id,
				nodeId: comment.node_id,
				pullRequestReviewId: comment.pull_request_review_id ?? null,
				body: comment.body,
				path: comment.path,
				line: comment.line ?? null,
				startLine: comment.start_line ?? null,
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

// ── Create issue/PR comment ────────────────────────────────────────

export type CreateCommentInput = {
	owner: string;
	repo: string;
	issueNumber: number;
	body: string;
};

export const createComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<CreateCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.issues.createComment({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				body: data.body,
			});

			// Bust caches so the comment appears immediately
			const userId = context.session.user.id;
			await Promise.all([
				bustGitHubCache(userId, "issues.comments", {
					owner: data.owner,
					repo: data.repo,
					issueNumber: data.issueNumber,
				}),
				bustGitHubCache(userId, "pulls.comments", {
					owner: data.owner,
					repo: data.repo,
					pullNumber: data.issueNumber,
				}),
				// Bump namespace versions to invalidate split-mode KV payloads
				bumpGitHubCacheNamespaces([
					githubRevalidationSignalKeys.pullEntity({
						owner: data.owner,
						repo: data.repo,
						pullNumber: data.issueNumber,
					}),
					githubRevalidationSignalKeys.issueEntity({
						owner: data.owner,
						repo: data.repo,
						issueNumber: data.issueNumber,
					}),
				]),
			]);

			return { ok: true };
		} catch (error) {
			return toMutationError("create comment", error);
		}
	});

// ── Edit issue/PR comment ─────────────────────────────────────────

export type EditCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
	body: string;
};

export const editComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<EditCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.issues.updateComment({
				owner: data.owner,
				repo: data.repo,
				comment_id: data.commentId,
				body: data.body,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("edit comment", error);
		}
	});

// ── Delete issue/PR comment ──────────────────────────────────────

export type DeleteCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
};

export const deleteComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<DeleteCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.issues.deleteComment({
				owner: data.owner,
				repo: data.repo,
				comment_id: data.commentId,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("delete comment", error);
		}
	});

// ── Edit review comment ──────────────────────────────────────────

export type EditReviewCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
	body: string;
};

export const editReviewComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<EditReviewCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.updateReviewComment({
				owner: data.owner,
				repo: data.repo,
				comment_id: data.commentId,
				body: data.body,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("edit review comment", error);
		}
	});

// ── Delete review comment ────────────────────────────────────────

export type DeleteReviewCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
};

export const deleteReviewComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<DeleteReviewCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			await context.octokit.rest.pulls.deleteReviewComment({
				owner: data.owner,
				repo: data.repo,
				comment_id: data.commentId,
			});
			return { ok: true };
		} catch (error) {
			return toMutationError("delete review comment", error);
		}
	});

// ── Minimize (hide) comment ──────────────────────────────────────

export type MinimizeCommentInput = {
	owner: string;
	repo: string;
	commentId: number;
	commentType: "issue" | "review";
};

export const minimizeComment = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<MinimizeCommentInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			// GitHub's minimize API requires the GraphQL node_id.
			// Fetch the comment first to get the node_id, then minimize via GraphQL.
			let nodeId: string;
			if (data.commentType === "review") {
				const { data: comment } =
					await context.octokit.rest.pulls.getReviewComment({
						owner: data.owner,
						repo: data.repo,
						comment_id: data.commentId,
					});
				nodeId = comment.node_id;
			} else {
				const { data: comment } = await context.octokit.rest.issues.getComment({
					owner: data.owner,
					repo: data.repo,
					comment_id: data.commentId,
				});
				nodeId = comment.node_id;
			}

			await context.octokit.graphql(
				`mutation($id: ID!, $classifier: ReportedContentClassifiers!) {
					minimizeComment(input: { subjectId: $id, classifier: $classifier }) {
						minimizedComment { isMinimized }
					}
				}`,
				{ id: nodeId, classifier: "OFF_TOPIC" },
			);

			return { ok: true };
		} catch (error) {
			return toMutationError("minimize comment", error);
		}
	});

export type CreateIssueInput = {
	owner: string;
	repo: string;
	title: string;
	body?: string;
	labels?: string[];
	assignees?: string[];
};

export type CreateIssueResult =
	| { ok: true; issueNumber: number }
	| { ok: false; error: string; installUrl?: string };

export const createIssue = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<CreateIssueInput>)
	.handler(async ({ data }): Promise<CreateIssueResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			const response = await context.octokit.rest.issues.create({
				owner: data.owner,
				repo: data.repo,
				title: data.title,
				body: data.body,
				labels: data.labels,
				assignees: data.assignees,
			});

			await bumpGitHubCacheNamespaces([
				githubRevalidationSignalKeys.issuesMine,
				githubRevalidationSignalKeys.repoMeta({
					owner: data.owner,
					repo: data.repo,
				}),
			]);

			return { ok: true, issueNumber: response.data.number };
		} catch (error) {
			const result = toMutationError("create issue", error);
			return { ok: false, error: result.ok ? "" : result.error };
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

		const teamsWithAccess = await withGitHubOperationTimeout(
			`github org team access ${data.org}/${data.repo}`,
			GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
			() =>
				Promise.all(
					teams.map(async (team) =>
						(await orgTeamHasRepoAccess(context, data, team)) ? team : null,
					),
				),
		);

		return teamsWithAccess.filter((team): team is OrgTeam => Boolean(team));
	});

export const requestPullReviewers = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<RequestReviewersInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubUserContextForRepository(data);
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
		const context = await getGitHubUserContextForRepository(data);
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
		const context = await getGitHubUserContextForRepository(data);
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
		const context = await getGitHubUserContextForRepository(data);
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
		const context = await getGitHubUserContextForRepository(data);
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

type UserProfileInput = { username: string };

export const getUserProfile = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<UserProfileInput>)
	.handler(async ({ data }): Promise<GitHubUserProfile | null> => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		try {
			const response = await context.octokit.rest.users.getByUsername({
				username: data.username,
			});
			const user = response.data;
			return {
				id: user.id,
				login: user.login,
				name: user.name ?? null,
				avatarUrl: user.avatar_url,
				bio: user.bio ?? null,
				company: user.company ?? null,
				location: user.location ?? null,
				blog: user.blog || null,
				twitterUsername: user.twitter_username ?? null,
				followers: user.followers ?? 0,
				following: user.following ?? 0,
				publicRepos: user.public_repos ?? 0,
				createdAt: user.created_at,
				url: user.html_url,
			};
		} catch (error) {
			if (error instanceof RequestError && error.status === 404) {
				return null;
			}
			throw error;
		}
	});

export const getUserContributions = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<UserProfileInput>)
	.handler(async ({ data }): Promise<GitHubContributionCalendar | null> => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		try {
			const response: {
				user: {
					contributionsCollection: {
						contributionCalendar: {
							totalContributions: number;
							weeks: Array<{
								contributionDays: Array<{
									date: string;
									contributionCount: number;
									contributionLevel:
										| "NONE"
										| "FIRST_QUARTILE"
										| "SECOND_QUARTILE"
										| "THIRD_QUARTILE"
										| "FOURTH_QUARTILE";
								}>;
							}>;
						};
					};
				};
			} = await executeGitHubGraphQL(
				context,
				`github user contributions ${data.username}`,
				`query($username: String!) {
					user(login: $username) {
						contributionsCollection {
							contributionCalendar {
								totalContributions
								weeks {
									contributionDays {
										date
										contributionCount
										contributionLevel
									}
								}
							}
						}
					}
				}`,
				{ username: data.username },
			);

			const calendar =
				response.user.contributionsCollection.contributionCalendar;
			const levelMap: Record<string, 0 | 1 | 2 | 3 | 4> = {
				NONE: 0,
				FIRST_QUARTILE: 1,
				SECOND_QUARTILE: 2,
				THIRD_QUARTILE: 3,
				FOURTH_QUARTILE: 4,
			};

			return {
				totalContributions: calendar.totalContributions,
				weeks: calendar.weeks.map(
					(week): ContributionWeek => ({
						days: week.contributionDays.map(
							(day): ContributionDay => ({
								date: day.date,
								count: day.contributionCount,
								level: levelMap[day.contributionLevel] ?? 0,
							}),
						),
					}),
				),
			};
		} catch {
			return null;
		}
	});

export const getUserPinnedRepos = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<UserProfileInput>)
	.handler(async ({ data }): Promise<PinnedRepo[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		try {
			const response: {
				user: {
					pinnedItems: {
						nodes: Array<{
							name: string;
							description: string | null;
							stargazerCount: number;
							primaryLanguage: { name: string; color: string } | null;
							url: string;
							owner: { login: string };
							isPrivate: boolean;
							forkCount: number;
						}>;
					};
				};
			} = await executeGitHubGraphQL(
				context,
				`github user pinned repos ${data.username}`,
				`query($username: String!) {
					user(login: $username) {
						pinnedItems(first: 6, types: REPOSITORY) {
							nodes {
								... on Repository {
									name
									description
									stargazerCount
									primaryLanguage { name color }
									url
									owner { login }
									isPrivate
									forkCount
								}
							}
						}
					}
				}`,
				{ username: data.username },
			);

			return response.user.pinnedItems.nodes.map((repo) => ({
				name: repo.name,
				description: repo.description,
				stars: repo.stargazerCount,
				language: repo.primaryLanguage?.name ?? null,
				languageColor: repo.primaryLanguage?.color ?? null,
				url: repo.url,
				owner: repo.owner.login,
				isPrivate: repo.isPrivate,
				forks: repo.forkCount,
			}));
		} catch {
			return [];
		}
	});

type UserActivityInput = {
	username: string;
	isOwnProfile: boolean;
	page: number;
};

export const getUserActivity = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<UserActivityInput>)
	.handler(async ({ data }): Promise<UserActivityEvent[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		try {
			const endpoint = data.isOwnProfile
				? "GET /users/{username}/events"
				: "GET /users/{username}/events/public";

			const response = await context.octokit.request(endpoint, {
				username: data.username,
				per_page: 30,
				page: data.page,
			});

			type GitHubEvent = (typeof response.data)[number];

			return response.data
				.map((event: GitHubEvent): UserActivityEvent | null => {
					const payload = event.payload as Record<string, unknown>;
					const type = event.type ?? "";

					type RawPR = {
						title?: string;
						number?: number;
						body?: string;
						additions?: number;
						deletions?: number;
						comments?: number;
						changed_files?: number;
						state?: string;
						draft?: boolean;
						merged?: boolean;
						html_url?: string;
						head?: { ref?: string };
						base?: { ref?: string };
						labels?: Array<{ name: string; color: string }>;
					};
					type RawIssue = {
						title?: string;
						number?: number;
						body?: string;
						comments?: number;
						state?: string;
						html_url?: string;
					};

					let action: string | null = null;
					let title: string | null = null;
					let ref: string | null = null;
					let refType: string | null = null;
					let commits: UserActivityEvent["commits"] = null;
					let commentBody: string | null = null;
					let prDetail: UserActivityEvent["prDetail"] = null;
					let issueDetail: UserActivityEvent["issueDetail"] = null;

					switch (type) {
						case "PushEvent":
							ref = (payload.ref as string)?.replace("refs/heads/", "") ?? null;
							commits = Array.isArray(payload.commits)
								? (payload.commits as Array<{ sha: string; message: string }>)
										.slice(0, 3)
										.map((c) => ({
											sha: c.sha.slice(0, 7),
											message: c.message.split("\n")[0],
										}))
								: null;
							break;
						case "CreateEvent":
						case "DeleteEvent":
							refType = (payload.ref_type as string) ?? null;
							ref = (payload.ref as string) ?? null;
							break;
						case "PullRequestEvent": {
							action = (payload.action as string) ?? null;
							const pr = payload.pull_request as RawPR | undefined;
							title = pr?.title ?? null;
							if (pr) {
								prDetail = {
									number: pr.number ?? 0,
									body: pr.body?.slice(0, 200) ?? null,
									additions: pr.additions ?? 0,
									deletions: pr.deletions ?? 0,
									comments: pr.comments ?? 0,
									changedFiles: pr.changed_files ?? 0,
									state: pr.merged ? "merged" : (pr.state ?? ""),
									isDraft: pr.draft ?? false,
									url: pr.html_url ?? "",
									headRef: pr.head?.ref ?? null,
									baseRef: pr.base?.ref ?? null,
									labels: (pr.labels ?? []).slice(0, 5).map((l) => ({
										name: l.name,
										color: l.color,
									})),
								};
							}
							break;
						}
						case "IssuesEvent": {
							action = (payload.action as string) ?? null;
							const issue = payload.issue as RawIssue | undefined;
							title = issue?.title ?? null;
							if (issue) {
								issueDetail = {
									number: issue.number ?? 0,
									body: issue.body?.slice(0, 200) ?? null,
									comments: issue.comments ?? 0,
									state: issue.state ?? "",
									url: issue.html_url ?? "",
								};
							}
							break;
						}
						case "IssueCommentEvent":
							action = "commented";
							title =
								(payload.issue as { title?: string } | undefined)?.title ??
								null;
							commentBody =
								(payload.comment as { body?: string } | undefined)?.body?.slice(
									0,
									200,
								) ?? null;
							break;
						case "WatchEvent":
							action = "starred";
							break;
						case "ForkEvent":
							action = "forked";
							break;
						case "ReleaseEvent":
							action = (payload.action as string) ?? null;
							title =
								(payload.release as { tag_name?: string } | undefined)
									?.tag_name ?? null;
							break;
						case "PullRequestReviewEvent": {
							action = (payload.action as string) ?? null;
							const reviewPr = payload.pull_request as RawPR | undefined;
							title = reviewPr?.title ?? null;
							if (reviewPr) {
								prDetail = {
									number: reviewPr.number ?? 0,
									body: reviewPr.body?.slice(0, 200) ?? null,
									additions: reviewPr.additions ?? 0,
									deletions: reviewPr.deletions ?? 0,
									comments: reviewPr.comments ?? 0,
									changedFiles: reviewPr.changed_files ?? 0,
									state: reviewPr.merged ? "merged" : (reviewPr.state ?? ""),
									isDraft: reviewPr.draft ?? false,
									url: reviewPr.html_url ?? "",
									headRef: reviewPr.head?.ref ?? null,
									baseRef: reviewPr.base?.ref ?? null,
									labels: (reviewPr.labels ?? []).slice(0, 5).map((l) => ({
										name: l.name,
										color: l.color,
									})),
								};
							}
							break;
						}
						default:
							return null;
					}

					return {
						id: event.id ?? "",
						type,
						createdAt: event.created_at ?? "",
						repo: {
							name: event.repo?.name ?? "",
							url: `https://github.com/${event.repo?.name ?? ""}`,
						},
						actor: {
							login: event.actor?.login ?? "",
							avatarUrl: event.actor?.avatar_url ?? "",
						},
						action,
						title,
						ref,
						refType,
						commits,
						commentBody,
						prDetail,
						issueDetail,
					};
				})
				.filter((e): e is UserActivityEvent => e !== null);
		} catch {
			return [];
		}
	});

// ---------------------------------------------------------------------------
// Repository overview
// ---------------------------------------------------------------------------

type RepoOverviewInput = {
	owner: string;
	repo: string;
};

export const getRepoOverview = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoOverviewInput>)
	.handler(async ({ data }): Promise<RepoOverview | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		const repoMetaKey = githubRevalidationSignalKeys.repoMeta(data);
		const repoCodeKey = githubRevalidationSignalKeys.repoCode(data);

		return getOrRevalidateGitHubResource<RepoOverview>({
			userId: context.session.user.id,
			resource: "repo.overview.v1",
			params: data,
			freshForMs: githubCachePolicy.repoMeta.staleTimeMs,
			signalKeys: [repoMetaKey, repoCodeKey],
			namespaceKeys: [repoMetaKey, repoCodeKey],
			cacheMode: "split",
			fetcher: async () => {
				const response =
					await executeGitHubGraphQL<GitHubGraphQLRepoOverviewResponse>(
						context,
						`github repo overview ${data.owner}/${data.repo}`,
						`query($owner: String!, $repo: String!) {
							repository(owner: $owner, name: $repo) {
								databaseId
								name
								nameWithOwner
								description
								isPrivate
								isFork
								defaultBranchRef {
									name
									target {
										__typename
										... on Commit {
											oid
											message
											committedDate
											author {
												user {
													login
													avatarUrl
													url
												}
											}
										}
									}
								}
								stargazerCount
								forkCount
								watchers(first: 1) {
									totalCount
								}
								primaryLanguage {
									name
								}
								licenseInfo {
									spdxId
								}
								repositoryTopics(first: 20) {
									nodes {
										topic {
											name
										}
									}
								}
								url
								owner {
									login
									avatarUrl
								}
								branches: refs(refPrefix: "refs/heads/", first: 1) {
									totalCount
								}
								tags: refs(refPrefix: "refs/tags/", first: 1) {
									totalCount
								}
								pullRequests(states: OPEN, first: 1) {
									totalCount
								}
								issues(states: OPEN, first: 1) {
									totalCount
								}
								hasDiscussionsEnabled
							}
							rateLimit {
								cost
								remaining
								resetAt
							}
						}`,
						{
							owner: data.owner,
							repo: data.repo,
						},
					);

				if (!response.repository) {
					throw new Error(
						`GitHub repository not found: ${data.owner}/${data.repo}`,
					);
				}

				return {
					kind: "success",
					data: mapGraphQLRepoOverview(response.repository),
					metadata: createGraphQLResponseMetadata(response.rateLimit),
				};
			},
		});
	});

// ---------------------------------------------------------------------------
// Repository discussions (GraphQL-only)
// ---------------------------------------------------------------------------

type RepoDiscussionsInput = {
	owner: string;
	repo: string;
	first?: number;
};

type GraphQLDiscussionsResponse = {
	repository: {
		discussions: {
			totalCount: number;
			nodes: Array<{
				number: number;
				title: string;
				createdAt: string;
				updatedAt: string;
				author: { login: string; avatarUrl: string } | null;
				category: { name: string; emojiHTML: string } | null;
				comments: { totalCount: number };
				answerChosenAt: string | null;
				url: string;
			}>;
		};
	};
};

export const getRepoDiscussions = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoDiscussionsInput>)
	.handler(async ({ data }): Promise<DiscussionsResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { discussions: [], totalCount: 0 };

		return getOrRevalidateGitHubResource<DiscussionsResult>({
			userId: context.session.user.id,
			resource: "repo.discussions.v1",
			params: {
				owner: data.owner,
				repo: data.repo,
				first: data.first ?? 5,
			},
			freshForMs: githubCachePolicy.list.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.repoMeta(data)],
			namespaceKeys: [githubRevalidationSignalKeys.repoMeta(data)],
			cacheMode: "split",
			fetcher: async () => {
				try {
					const response =
						await executeGitHubGraphQL<GraphQLDiscussionsResponse>(
							context,
							`github repo discussions ${data.owner}/${data.repo}`,
							`query($owner: String!, $repo: String!, $first: Int!) {
								repository(owner: $owner, name: $repo) {
									discussions(first: $first, orderBy: { field: UPDATED_AT, direction: DESC }) {
										totalCount
										nodes {
											number
											title
											createdAt
											updatedAt
											author { login avatarUrl }
											category { name emojiHTML }
											comments { totalCount }
											answerChosenAt
											url
										}
									}
								}
							}`,
							{
								owner: data.owner,
								repo: data.repo,
								first: data.first ?? 5,
							},
						);

					return {
						kind: "success",
						data: {
							totalCount: response.repository.discussions.totalCount,
							discussions: response.repository.discussions.nodes.map((d) => ({
								number: d.number,
								title: d.title,
								createdAt: d.createdAt,
								updatedAt: d.updatedAt,
								author: d.author,
								category: d.category?.name ?? null,
								comments: d.comments.totalCount,
								isAnswered: d.answerChosenAt !== null,
								url: d.url,
							})),
						},
						metadata: createGitHubResponseMetadata(200, {}),
					};
				} catch (error) {
					if (
						error instanceof RequestError &&
						(error.status === 403 || error.status === 429)
					) {
						throw error;
					}

					return {
						kind: "success",
						data: { discussions: [], totalCount: 0 },
						metadata: createGitHubResponseMetadata(200, {}),
					};
				}
			},
		});
	});

function parseLinkHeaderLastPage(link: string | undefined): number | null {
	if (!link) return null;
	const match = link.match(/[&?]page=(\d+)[^>]*>;\s*rel="last"/);
	return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Repository branches
// ---------------------------------------------------------------------------

type RepoBranchesInput = {
	owner: string;
	repo: string;
};

export const getRepoBranches = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoBranchesInput>)
	.handler(async ({ data }): Promise<RepoBranch[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];

		return getCachedGitHubRequest<
			Awaited<
				ReturnType<GitHubClient["rest"]["repos"]["listBranches"]>
			>["data"],
			RepoBranch[]
		>({
			context,
			resource: "repo.branches.v1",
			params: data,
			freshForMs: githubCachePolicy.repoMeta.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.repoCode(data)],
			namespaceKeys: [githubRevalidationSignalKeys.repoCode(data)],
			cacheMode: "split",
			request: (headers) =>
				context.octokit.rest.repos.listBranches({
					owner: data.owner,
					repo: data.repo,
					per_page: 25,
					headers,
				}),
			mapData: (branches) =>
				branches.map((b) => ({
					name: b.name,
					isProtected: b.protected,
				})),
		});
	});

// ---------------------------------------------------------------------------
// Repository tree contents
// ---------------------------------------------------------------------------

type RepoTreeInput = {
	owner: string;
	repo: string;
	ref: string;
	path: string;
};

export const getRepoTree = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoTreeInput>)
	.handler(async ({ data }): Promise<RepoTreeEntry[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];

		return getCachedGitHubRequest<
			Awaited<ReturnType<GitHubClient["rest"]["repos"]["getContent"]>>["data"],
			RepoTreeEntry[]
		>({
			context,
			resource: "repo.tree.v1",
			params: data,
			freshForMs: githubCachePolicy.detail.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.repoCode(data)],
			namespaceKeys: [githubRevalidationSignalKeys.repoCode(data)],
			cacheMode: "split",
			request: (headers) =>
				context.octokit.rest.repos.getContent({
					owner: data.owner,
					repo: data.repo,
					path: data.path,
					ref: data.ref,
					headers,
				}),
			mapData: (content) => {
				if (!Array.isArray(content)) return [];

				const entries: RepoTreeEntry[] = content.map((item) => ({
					name: item.name,
					type:
						item.type === "dir"
							? "dir"
							: item.type === "submodule"
								? "submodule"
								: "file",
					path: item.path,
					sha: item.sha,
					size: item.size ?? null,
					lastCommit: null,
				}));

				entries.sort((a, b) => {
					if (a.type === "dir" && b.type !== "dir") return -1;
					if (a.type !== "dir" && b.type === "dir") return 1;
					return a.name.localeCompare(b.name);
				});

				return entries;
			},
		});
	});

// ---------------------------------------------------------------------------
// Repository file content
// ---------------------------------------------------------------------------

type RepoFileContentInput = {
	owner: string;
	repo: string;
	path: string;
	ref: string;
};

export const getRepoFileContent = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoFileContentInput>)
	.handler(async ({ data }): Promise<string | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		return getCachedGitHubRequest<
			Awaited<ReturnType<GitHubClient["rest"]["repos"]["getContent"]>>["data"],
			string | null
		>({
			context,
			resource: "repo.fileContent.v1",
			params: data,
			freshForMs: githubCachePolicy.repoMeta.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.repoCode(data)],
			namespaceKeys: [githubRevalidationSignalKeys.repoCode(data)],
			cacheMode: "split",
			request: (headers) =>
				context.octokit.rest.repos.getContent({
					owner: data.owner,
					repo: data.repo,
					path: data.path,
					ref: data.ref,
					headers,
				}),
			mapData: (content) => {
				if (Array.isArray(content) || !("content" in content)) return null;
				return Buffer.from(content.content, "base64").toString("utf-8");
			},
		}).catch(() => null);
	});

// ---------------------------------------------------------------------------
// Repository contributors
// ---------------------------------------------------------------------------

type RepoContributorsInput = {
	owner: string;
	repo: string;
};

export const getRepoContributors = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoContributorsInput>)
	.handler(async ({ data }): Promise<RepoContributorsResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { contributors: [], totalCount: 0 };

		return getOrRevalidateGitHubResource<RepoContributorsResult>({
			userId: context.session.user.id,
			resource: "repo.contributors.v1",
			params: data,
			freshForMs: githubCachePolicy.repoMeta.staleTimeMs,
			signalKeys: [githubRevalidationSignalKeys.repoCode(data)],
			namespaceKeys: [githubRevalidationSignalKeys.repoCode(data)],
			cacheMode: "split",
			fetcher: async (conditionals) => {
				try {
					const response = await context.octokit.rest.repos.listContributors({
						owner: data.owner,
						repo: data.repo,
						per_page: 30,
						anon: "false",
						headers: buildConditionalHeaders(conditionals),
					});
					const totalCount =
						parseLinkHeaderLastPage(
							response.headers.link as string | undefined,
						) ?? response.data.length;

					return {
						kind: "success",
						data: {
							contributors: response.data
								.filter((c): c is typeof c & { login: string } => !!c.login)
								.map((c) => ({
									login: c.login,
									avatarUrl: c.avatar_url ?? "",
									contributions: c.contributions ?? 0,
								})),
							totalCount,
						},
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
			},
		});
	});

// ── Notifications ──────────────────────────────────────────────────────

type GetNotificationsInput = {
	all?: boolean;
	participating?: boolean;
};

export const getNotifications = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<GetNotificationsInput>)
	.handler(async ({ data }): Promise<NotificationsResult> => {
		const context = await getGitHubContext();
		if (!context) {
			return { notifications: [] };
		}

		const response =
			await context.octokit.rest.activity.listNotificationsForAuthenticatedUser(
				{
					all: data.all ?? false,
					participating: data.participating ?? false,
					per_page: 50,
				},
			);

		// Batch-fetch participants for PR/Issue notifications in parallel
		const participantMap = new Map<string, NotificationParticipant[]>();
		const stateMap = new Map<string, "open" | "closed" | "merged">();
		const fetchable = response.data.filter(
			(n) =>
				n.subject.url &&
				(n.subject.type === "PullRequest" || n.subject.type === "Issue"),
		);

		await Promise.allSettled(
			fetchable.map(async (n) => {
				try {
					const seen = new Set<string>();
					const participants: NotificationParticipant[] = [];
					const add = (login: string, avatarUrl: string) => {
						if (seen.has(login)) return;
						seen.add(login);
						participants.push({ login, avatarUrl });
					};

					// Fetch subject detail + comments (and reviews for PRs) in parallel
					const subjectUrl = n.subject.url!;
					const commentsUrl = `${subjectUrl}/comments`;
					const isPR = n.subject.type === "PullRequest";
					const reviewsUrl = isPR ? `${subjectUrl}/reviews` : null;

					const [subjectRes, commentsRes, reviewsRes] = await Promise.all([
						context.octokit.request("GET {url}", { url: subjectUrl }),
						context.octokit
							.request("GET {url}", { url: commentsUrl, per_page: 100 })
							.catch(() => null),
						reviewsUrl
							? context.octokit
									.request("GET {url}", { url: reviewsUrl, per_page: 100 })
									.catch(() => null)
							: null,
					]);

					const d = subjectRes.data as {
						user?: { login: string; avatar_url: string };
						assignees?: Array<{ login: string; avatar_url: string }>;
						requested_reviewers?: Array<{ login: string; avatar_url: string }>;
						state?: string;
						merged?: boolean;
					};

					// Extract subject state (open/closed/merged)
					if (d.state) {
						const state = d.merged
							? "merged"
							: d.state === "closed"
								? "closed"
								: "open";
						stateMap.set(n.id, state);
					}

					if (d.user) add(d.user.login, d.user.avatar_url);
					for (const a of d.assignees ?? []) add(a.login, a.avatar_url);
					for (const r of d.requested_reviewers ?? [])
						add(r.login, r.avatar_url);

					// Add commenters
					if (commentsRes?.data && Array.isArray(commentsRes.data)) {
						for (const c of commentsRes.data as Array<{
							user?: { login: string; avatar_url: string };
						}>) {
							if (c.user) add(c.user.login, c.user.avatar_url);
						}
					}

					// Add reviewers (PRs only)
					if (reviewsRes?.data && Array.isArray(reviewsRes.data)) {
						for (const r of reviewsRes.data as Array<{
							user?: { login: string; avatar_url: string };
						}>) {
							if (r.user) add(r.user.login, r.user.avatar_url);
						}
					}

					participantMap.set(n.id, participants);
				} catch {
					// Silently skip — participant data is best-effort
				}
			}),
		);

		const notifications: NotificationItem[] = response.data.map((n) => ({
			id: n.id,
			unread: n.unread,
			reason: n.reason as NotificationItem["reason"],
			subject: {
				title: n.subject.title,
				url: n.subject.url ?? null,
				latestCommentUrl: n.subject.latest_comment_url ?? null,
				type: n.subject.type as NotificationItem["subject"]["type"],
			},
			repository: {
				id: n.repository.id,
				name: n.repository.name,
				fullName: n.repository.full_name,
				owner: {
					login: n.repository.owner.login,
					avatarUrl: n.repository.owner.avatar_url,
					url: n.repository.owner.html_url ?? n.repository.owner.url,
					type: n.repository.owner.type ?? "User",
				},
				private: n.repository.private,
			},
			participants: participantMap.get(n.id) ?? [],
			subjectState: stateMap.get(n.id) ?? null,
			updatedAt: n.updated_at,
			lastReadAt: n.last_read_at ?? null,
			url: n.url,
		}));

		return { notifications };
	});

type MarkNotificationReadInput = { threadId: string };

export const markNotificationRead = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<MarkNotificationReadInput>)
	.handler(async ({ data }): Promise<{ ok: boolean }> => {
		const context = await getGitHubContext();
		if (!context) {
			return { ok: false };
		}

		await context.octokit.rest.activity.markThreadAsRead({
			thread_id: Number.parseInt(data.threadId, 10),
		});

		return { ok: true };
	});

export const markNotificationDone = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<MarkNotificationReadInput>)
	.handler(async ({ data }): Promise<{ ok: boolean }> => {
		const context = await getGitHubContext();
		if (!context) {
			return { ok: false };
		}

		await context.octokit.rest.activity.markThreadAsDone({
			thread_id: Number.parseInt(data.threadId, 10),
		});

		return { ok: true };
	});

export const markAllNotificationsRead = createServerFn({
	method: "POST",
}).handler(async (): Promise<{ ok: boolean }> => {
	const context = await getGitHubContext();
	if (!context) {
		return { ok: false };
	}

	await context.octokit.rest.activity.markNotificationsAsRead({
		last_read_at: new Date().toISOString(),
	});

	return { ok: true };
});

type RevalidationSignalTimestampsInput = { signalKeys: string[] };

export const getRevalidationSignalTimestamps = createServerFn({
	method: "GET",
})
	.inputValidator(identityValidator<RevalidationSignalTimestampsInput>)
	.handler(
		async ({
			data,
		}): Promise<Array<{ signalKey: string; updatedAt: number }>> => {
			const { getRequestSession } = await import("./auth-runtime");
			const session = await getRequestSession();
			if (!session) {
				return [];
			}

			const { getGitHubRevalidationSignals } = await import("./github-cache");
			return getGitHubRevalidationSignals(data.signalKeys);
		},
	);
