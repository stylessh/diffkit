import { createServerFn } from "@tanstack/react-start";
import { type Octokit as OctokitType, RequestError } from "octokit";
import type {
	CreateLabelInput,
	CreateReviewCommentInput,
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
	login?: string;
	avatar_url?: string | null;
	type?: string;
};

type GitHubUserInstallationPayload = {
	id?: number;
	account?: GitHubInstallationAccountPayload | null;
	html_url?: string | null;
	target_type?: string;
	repository_selection?: string;
	suspended_at?: string | null;
};

type GitHubUserInstallationsPayload = {
	installations?: GitHubUserInstallationPayload[];
};

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

			return mapPullSummary(item, repository);
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
	const [reviewsResponse, checksResponse, repoResponse] = await Promise.all([
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
		context.octokit.rest.repos
			.get({ owner: data.owner, repo: data.repo })
			.catch(() => null),
	]);

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

	const permissions =
		repoResponse?.data.permissions ?? pull.base.repo.permissions;
	const canUpdateBranch =
		!permissions || permissions.push === true || permissions.admin === true;
	const canBypassProtections = permissions?.admin === true;

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
		resource: "pulls.status.v1",
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
	const publicInstallUrl = buildGitHubAppInstallUrl(appSlug);

	// GET /user/installations requires a GitHub App user-to-server token (ghu_).
	// With an OAuth App token (gho_), this endpoint returns 403 — expected behavior.
	let installations: GitHubAppInstallation[] = [];
	let installationsAvailable = false;
	try {
		const installationsResponse = await context.octokit.request(
			"GET /user/installations",
			{
				per_page: 100,
			},
		);
		installationsAvailable = true;
		const payload =
			installationsResponse.data as GitHubUserInstallationsPayload;
		installations = (payload.installations ?? []).flatMap((installation) => {
			if (!installation.id || !installation.account?.login) {
				return [];
			}

			const targetType = toInstallationTargetType(installation.target_type);

			return [
				{
					id: installation.id,
					account: {
						login: installation.account.login,
						name: null,
						avatarUrl: installation.account.avatar_url ?? null,
						type: toInstallationTargetType(installation.account.type),
					},
					targetType,
					repositorySelection:
						installation.repository_selection === "all" ||
						installation.repository_selection === "selected"
							? installation.repository_selection
							: "unknown",
					manageUrl: installation.html_url ?? null,
					suspendedAt: installation.suspended_at ?? null,
				},
			];
		});
	} catch {
		// Silently ignored — OAuth App tokens cannot list GitHub App installations.
	}

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
	const installedOrganizationLogins = new Set(
		orgInstallations.map((installation) =>
			installation.account.login.toLowerCase(),
		),
	);

	return {
		viewerLogin,
		appSlug,
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
		if (!context) {
			return { events: [], hasMore: false };
		}

		return getRestTimelineEventsPage(context, data, data.page);
	});

export const getPullFromRepo = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullDetail | null> => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		return getPullDetailResult(context, data);
	});

export const getPullComments = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullComment[]> => {
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		return getIssueDetailResult(context, data);
	});

export const getIssueComments = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<IssueFromRepoInput>)
	.handler(async ({ data }): Promise<IssueComment[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		return getIssueCommentsResult(context, data);
	});

export const getIssuePageData = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<IssueFromRepoInput>)
	.handler(async ({ data }): Promise<IssuePageData | null> => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		return getIssuePageDataResult(context, data);
	});

export const getPullStatus = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullStatus | null> => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		return getPullStatusResult(context, data);
	});

export const getPullPageData = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullPageData | null> => {
		const context = await getGitHubContext();
		if (!context) {
			return null;
		}

		return getPullPageDataResult(context, data);
	});

type UpdatePullBodyInput = PullFromRepoInput & { body: string };

export const updatePullBody = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<UpdatePullBodyInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		return getPullFileSummariesResult(context, data);
	});

export const getPullFiles = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFilesPageInput>)
	.handler(async ({ data }): Promise<PullFilesPage> => {
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		return getPullReviewCommentsResult(context, data);
	});

export const submitPullReview = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<SubmitReviewInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		return getCachedPaginatedGitHubRequest<
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
					page,
					per_page: 100,
				}),
			mapData: (allCollaborators) =>
				allCollaborators.map((c) => ({
					login: c.login,
					avatarUrl: c.avatar_url,
					permissions: {
						admin: c.permissions?.admin ?? false,
						push: c.permissions?.push ?? false,
						pull: c.permissions?.pull ?? false,
					},
				})),
		}).catch(() => []);
	});

export type OrgTeamsInput = {
	org: string;
};

export const getOrgTeams = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<OrgTeamsInput>)
	.handler(async ({ data }): Promise<OrgTeam[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		return getCachedPaginatedGitHubRequest<
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
				allTeams.map((t) => ({
					slug: t.slug,
					name: t.name,
				})),
		}).catch(() => []);
	});

export const requestPullReviewers = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<RequestReviewersInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
		const context = await getGitHubContext();
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
