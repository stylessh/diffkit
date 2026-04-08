import { createServerFn } from "@tanstack/react-start";
import { type Octokit as OctokitType, RequestError } from "octokit";
import type {
	CreateReviewCommentInput,
	GitHubActor,
	GitHubLabel,
	IssueComment,
	IssueDetail,
	IssuePageData,
	IssueSummary,
	MyIssuesResult,
	MyPullsResult,
	PullComment,
	PullDetail,
	PullFile,
	PullPageData,
	PullReviewComment,
	PullStatus,
	PullSummary,
	RepositoryRef,
	SubmitReviewInput,
	UserRepoSummary,
} from "./github.types";
import {
	createGitHubResponseMetadata,
	type GitHubConditionalHeaders,
	type GitHubFetchResult,
	getOrRevalidateGitHubResource,
} from "./github-cache";
import { githubCachePolicy } from "./github-cache-policy";

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
		mergeable: pull.mergeable,
		mergeableState:
			typeof pull.mergeable_state === "string" ? pull.mergeable_state : null,
		requestedReviewers: (pull.requested_reviewers ?? [])
			.map((reviewer) => mapActor(reviewer))
			.filter((reviewer): reviewer is GitHubActor => Boolean(reviewer)),
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
	request,
	mapData,
}: {
	context: GitHubContext;
	resource: string;
	params: unknown;
	freshForMs: number;
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
	return getCachedGitHubRequest<RepoPullDetail, RepoPullDetail>({
		context,
		resource,
		params: data,
		freshForMs,
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

	return getCachedGitHubRequest<IssueComment[], PullComment[]>({
		context,
		resource: "pulls.comments",
		params: data,
		freshForMs: githubCachePolicy.activity.staleTimeMs,
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

async function computePullStatus(
	context: GitHubContext,
	data: PullFromRepoInput,
	pull: RepoPullDetail,
): Promise<PullStatus> {
	const [reviewsResponse, checksResponse] = await Promise.all([
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

	const permissions = pull.base.repo.permissions;
	const canUpdateBranch =
		permissions?.push === true || permissions?.admin === true;

	return {
		reviews: Array.from(latestReviews.values()),
		checks: {
			total: checkRuns.length,
			passed,
			failed,
			pending,
			skipped,
		},
		mergeable: pull.mergeable,
		mergeableState:
			typeof pull.mergeable_state === "string" ? pull.mergeable_state : null,
		behindBy,
		baseRefName: pull.base.ref,
		canUpdateBranch,
	};
}

async function getPullStatusResult(
	context: GitHubContext,
	data: PullFromRepoInput,
	pull?: RepoPullDetail,
): Promise<PullStatus> {
	return getOrRevalidateGitHubResource<PullStatus>({
		userId: context.session.user.id,
		resource: "pulls.status.v1",
		params: data,
		freshForMs: githubCachePolicy.status.staleTimeMs,
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

	const comments = await getPullCommentsResult(context, data);

	return {
		detail: mapPullDetail(pull, buildRepositoryRef(data.owner, data.repo)),
		comments,
	};
}

async function getIssueDetailResult(
	context: GitHubContext,
	data: IssueFromRepoInput,
): Promise<IssueDetail | null> {
	return getCachedGitHubRequest<RepoIssueDetail, IssueDetail | null>({
		context,
		resource: "issues.detail",
		params: data,
		freshForMs: githubCachePolicy.detail.staleTimeMs,
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

	return getCachedGitHubRequest<RawIssueComment[], IssueComment[]>({
		context,
		resource: "issues.comments",
		params: data,
		freshForMs: githubCachePolicy.activity.staleTimeMs,
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
	const [detail, comments] = await Promise.all([
		getIssueDetailResult(context, data),
		getIssueCommentsResult(context, data),
	]);

	return {
		detail,
		comments,
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

export const updatePullBranch = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubContext();
		if (!context) {
			return false;
		}

		try {
			await context.octokit.rest.pulls.updateBranch({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
			});
			return true;
		} catch {
			return false;
		}
	});

async function getPullFilesResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullFile[]> {
	return getCachedGitHubRequest<RepoPullFile[], PullFile[]>({
		context,
		resource: "pulls.files",
		params: data,
		freshForMs: githubCachePolicy.detail.staleTimeMs,
		request: (headers) =>
			context.octokit.rest.pulls.listFiles({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				per_page: 300,
				headers,
			}),
		mapData: (files) =>
			files.map((file) => ({
				sha: file.sha,
				filename: file.filename,
				status: file.status as PullFile["status"],
				additions: file.additions,
				deletions: file.deletions,
				changes: file.changes,
				patch: file.patch ?? null,
				previousFilename: file.previous_filename ?? null,
			})),
	});
}

export const getPullFiles = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullFile[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		return getPullFilesResult(context, data);
	});

async function getPullReviewCommentsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullReviewComment[]> {
	return getCachedGitHubRequest<RepoPullReviewComment[], PullReviewComment[]>({
		context,
		resource: "pulls.reviewComments",
		params: data,
		freshForMs: githubCachePolicy.activity.staleTimeMs,
		request: (headers) =>
			context.octokit.rest.pulls.listReviewComments({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				per_page: 100,
				headers,
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
