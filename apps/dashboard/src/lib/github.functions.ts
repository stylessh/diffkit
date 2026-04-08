import { createServerFn } from "@tanstack/react-start";
import { type Octokit as OctokitType, RequestError } from "octokit";
import type {
	GitHubActor,
	GitHubLabel,
	IssueDetail,
	IssueSummary,
	MyIssuesResult,
	MyPullsResult,
	PullDetail,
	PullSummary,
	RepositoryRef,
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
type AuthSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
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

async function getSession() {
	const [{ getRequest }, { getAuth }] = await Promise.all([
		import("@tanstack/react-start/server"),
		import("./auth.server"),
	]);
	const request = getRequest();
	const auth = getAuth();
	return auth.api.getSession({ headers: request.headers });
}

async function getGitHubContext(): Promise<GitHubContext | null> {
	const session = await getSession();
	if (!session) {
		return null;
	}

	return {
		session,
		octokit: await (await import("./github.server")).getGitHubClient(
			session.user.id,
		),
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

		return getCachedGitHubRequest<RepoPullDetail, PullDetail | null>({
			context,
			resource: "pulls.detail",
			params: data,
			freshForMs: githubCachePolicy.detail.staleTimeMs,
			request: (headers) =>
				context.octokit.rest.pulls.get({
					owner: data.owner,
					repo: data.repo,
					pull_number: data.pullNumber,
					headers,
				}),
			mapData: (pull) =>
				mapPullDetail(pull, buildRepositoryRef(data.owner, data.repo)),
		});
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
	});
