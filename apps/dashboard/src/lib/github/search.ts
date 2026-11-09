import { createServerFn } from "@tanstack/react-start";
import type {
	CommandPaletteSearchResult,
	IssueSummary,
	MyIssuesResult,
	MyPullsResult,
	PullSummary,
	RepositoryRef,
} from "../github.types";
import type { GitHubInstallationAccessIndex } from "../github-access";
import {
	fetchGitHubResource,
	getGitHubContext,
	getViewer,
	resolveUsername,
	withGitHubOperationTimeout,
} from "./client";
import {
	filterItemsByInstallationAccess,
	filterMyPullsResult,
	getInstallationAccessIndex,
} from "./installations";
import { buildRepositoryRef, mapIssueSummary, mapPullSummary } from "./mappers";
import {
	buildUserSearchQuery,
	getMyIssuesResult,
	getMyPullsResult,
} from "./my-search";
import {
	clampPage,
	clampPerPage,
	GITHUB_OPERATION_TIMEOUT_MS,
	type GitHubClient,
	type IssueSearchRole,
	type PullSearchRole,
	type RepoState,
} from "./shared";
import { identityValidator } from "./validators";

type SearchItem = Awaited<
	ReturnType<GitHubClient["rest"]["search"]["issuesAndPullRequests"]>
>["data"]["items"][number];
type SearchResult = Awaited<
	ReturnType<GitHubClient["rest"]["search"]["issuesAndPullRequests"]>
>["data"];

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

export type CommandPaletteSearchInput = {
	query: string;
	perPage?: number;
};

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

function parseRepositoryRef(
	repositoryUrl?: string | null,
	isPrivate: boolean | null = null,
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
		isPrivate,
	);
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

export const searchCommandPaletteGitHub = createServerFn({ method: "GET" })
	.validator(identityValidator<CommandPaletteSearchInput>)
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
		const [pullItems, issueItems, accessIndex] = await Promise.all([
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
			getInstallationAccessIndex(context),
		]);

		return {
			pulls: filterItemsByInstallationAccess(
				mapPullSearchItems(pullItems),
				accessIndex,
			),
			issues: filterItemsByInstallationAccess(
				mapIssueSearchItems(issueItems),
				accessIndex,
			),
		};
	});

function filterMyIssuesResult(
	result: MyIssuesResult,
	accessIndex: GitHubInstallationAccessIndex,
): MyIssuesResult {
	return {
		...result,
		assigned: filterItemsByInstallationAccess(result.assigned, accessIndex),
		authored: filterItemsByInstallationAccess(result.authored, accessIndex),
		mentioned: filterItemsByInstallationAccess(result.mentioned, accessIndex),
	};
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
		const [result, accessIndex] = await Promise.all([
			getMyPullsResult({
				context,
				username: viewer.login,
			}),
			getInstallationAccessIndex(context),
		]);
		return filterMyPullsResult(result, accessIndex);
	},
);

export const getPullsFromUser = createServerFn({ method: "GET" })
	.validator(identityValidator<PullsFromUserInput>)
	.handler(async ({ data }): Promise<PullSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		const username = await resolveUsername(context, data.username);

		return fetchGitHubResource<SearchResult, PullSummary[]>({
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
			request: () =>
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
				}),
			mapData: (result) => mapPullSearchItems(result.items),
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
		const [result, accessIndex] = await Promise.all([
			getMyIssuesResult({
				context,
				username: viewer.login,
			}),
			getInstallationAccessIndex(context),
		]);
		return filterMyIssuesResult(result, accessIndex);
	},
);

export const getIssuesFromUser = createServerFn({ method: "GET" })
	.validator(identityValidator<IssuesFromUserInput>)
	.handler(async ({ data }): Promise<IssueSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		const username = await resolveUsername(context, data.username);

		return fetchGitHubResource<SearchResult, IssueSummary[]>({
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
			request: () =>
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
				}),
			mapData: (result) => mapIssueSearchItems(result.items),
		});
	});
