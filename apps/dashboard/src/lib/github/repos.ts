import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import { debug } from "../debug";
import type { UserRepoSummary } from "../github.types";
import { isRepoVisibleWithInstallationAccess } from "../github-access";
import {
	filterUserRepoSummaries,
	type ReposHubInput,
	type ReposHubResult,
} from "../repos-hub-filter";
import {
	fetchPaginatedGitHubResource,
	getGitHubContext,
	getViewer,
} from "./client";
import {
	getGitHubUserContextForRepository,
	getInstallationAccessIndex,
} from "./installations";
import {
	type GitHubClient,
	type GitHubContext,
	type MutationFailure,
	type MutationResult,
	toMutationError,
} from "./shared";
import type { UserProfileInput } from "./users";
import { identityValidator } from "./validators";

type AuthenticatedUserRepo = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["listForAuthenticatedUser"]>
>["data"][number];
type ListForUserRepo = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["listForUser"]>
>["data"][number];

function mapGithubRestRepoToUserRepoSummary(
	repo: AuthenticatedUserRepo | ListForUserRepo,
): UserRepoSummary {
	const repoId = repo.id;
	if (typeof repoId !== "number") {
		throw new Error("GitHub repository payload missing id");
	}

	const visibility: UserRepoSummary["visibility"] =
		repo.visibility === "internal"
			? "internal"
			: repo.visibility === "private" || repo.private
				? "private"
				: "public";
	return {
		id: repoId,
		name: repo.name ?? "",
		fullName: repo.full_name ?? "",
		description: repo.description ?? null,
		stars: repo.stargazers_count ?? 0,
		forks: repo.forks_count ?? 0,
		language: repo.language ?? null,
		updatedAt: repo.updated_at ?? null,
		createdAt: repo.created_at ?? null,
		isPrivate: Boolean(repo.private),
		visibility,
		url: repo.html_url ?? "",
		owner: repo.owner.login ?? "",
	};
}

async function fetchInstallationFilteredAuthenticatedRepos(
	context: GitHubContext,
): Promise<UserRepoSummary[]> {
	const [repos, accessIndex] = await Promise.all([
		fetchPaginatedGitHubResource<AuthenticatedUserRepo, UserRepoSummary[]>({
			context,
			resource: "repos.list",
			params: { sort: "updated", perPage: 100 },
			pageSize: 100,
			request: (page) =>
				context.octokit.rest.repos.listForAuthenticatedUser({
					sort: "updated",
					per_page: 100,
					page,
				}),
			mapData: (items) => items.map(mapGithubRestRepoToUserRepoSummary),
		}),
		getInstallationAccessIndex(context),
	]);

	const filtered = repos.filter((repo) =>
		isRepoVisibleWithInstallationAccess(
			accessIndex,
			repo.owner,
			repo.name,
			repo.isPrivate,
		),
	);

	const removedCount = repos.length - filtered.length;
	if (removedCount > 0) {
		debug(
			"installation-access",
			"fetchInstallationFilteredAuthenticatedRepos",
			{
				total: repos.length,
				kept: filtered.length,
				removed: removedCount,
				removedRepos: repos
					.filter(
						(repo) =>
							!isRepoVisibleWithInstallationAccess(
								accessIndex,
								repo.owner,
								repo.name,
								repo.isPrivate,
							),
					)
					.map((repo) => repo.fullName),
			},
		);
	}

	return filtered;
}

async function fetchPublicReposForUser(
	context: GitHubContext,
	username: string,
): Promise<UserRepoSummary[]> {
	return fetchPaginatedGitHubResource<ListForUserRepo, UserRepoSummary[]>({
		context,
		resource: "repos.listForUser",
		params: { username, sort: "updated", perPage: 100 },
		pageSize: 100,
		request: (page, signal) =>
			context.octokit.rest.repos.listForUser({
				username,
				sort: "updated",
				per_page: 100,
				page,
				request: { signal },
			}),
		mapData: (items) => items.map(mapGithubRestRepoToUserRepoSummary),
	});
}

export const getUserRepos = createServerFn({ method: "GET" }).handler(
	async (): Promise<UserRepoSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}
		return fetchInstallationFilteredAuthenticatedRepos(context);
	},
);

export const getReposHub = createServerFn({ method: "GET" })
	.validator(identityValidator<ReposHubInput>)
	.handler(async ({ data }): Promise<ReposHubResult> => {
		const context = await getGitHubContext();
		if (!context) {
			return {
				totals: { all: 0, public: 0, private: 0 },
				matchingCount: 0,
				repos: [],
			};
		}

		const limit = Math.min(Math.max(1, data.limit), 10_000);
		const all = await fetchInstallationFilteredAuthenticatedRepos(context);
		const totals = {
			all: all.length,
			public: all.filter((r) => !r.isPrivate).length,
			private: all.filter((r) => r.isPrivate).length,
		};
		const filtered = filterUserRepoSummaries(all, {
			searchQuery: data.searchQuery,
			visibility: data.visibility,
			sortId: data.sortId,
		});

		return {
			totals,
			matchingCount: filtered.length,
			repos: filtered.slice(0, limit),
		};
	});

export const getProfileRepos = createServerFn({ method: "GET" })
	.validator(identityValidator<UserProfileInput>)
	.handler(async ({ data }): Promise<UserRepoSummary[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		const viewer = await getViewer(context);
		const isOwnProfile =
			viewer.login.toLowerCase() === data.username.toLowerCase();

		if (isOwnProfile) {
			return fetchInstallationFilteredAuthenticatedRepos(context);
		}

		try {
			return await fetchPublicReposForUser(context, data.username);
		} catch (error) {
			if (error instanceof RequestError && error.status === 404) {
				return [];
			}
			throw error;
		}
	});

export type SetRepoStarredInput = {
	owner: string;
	repo: string;
	starred: boolean;
};

export const setRepoStarred = createServerFn({ method: "POST" })
	.validator(identityValidator<SetRepoStarredInput>)
	.handler(async ({ data }): Promise<MutationResult> => {
		const target = `${data.owner}/${data.repo}`;
		debug("github-star", "setRepoStarred called", {
			target,
			starred: data.starred,
		});
		console.info("[github-star] request", {
			target,
			starred: data.starred,
		});

		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			debug("github-star", "no GitHub user context (OAuth token?)", {
				target,
			});
			console.warn("[github-star] aborted: no user context", { target });
			return { ok: false, error: "Not authenticated" };
		}

		try {
			debug("github-star", "calling GitHub activity API", {
				target,
				action: data.starred ? "star" : "unstar",
			});
			console.info("[github-star] calling octokit.rest.activity", {
				target,
				action: data.starred
					? "starRepoForAuthenticatedUser"
					: "unstarRepoForAuthenticatedUser",
			});

			if (data.starred) {
				await context.octokit.rest.activity.starRepoForAuthenticatedUser({
					owner: data.owner,
					repo: data.repo,
				});
			} else {
				await context.octokit.rest.activity.unstarRepoForAuthenticatedUser({
					owner: data.owner,
					repo: data.repo,
				});
			}

			debug("github-star", "success", { target });
			console.info("[github-star] ok", { target, starred: data.starred });

			return { ok: true };
		} catch (error) {
			const errMeta =
				error instanceof RequestError
					? {
							status: error.status,
							message: error.message,
							request: error.request?.url,
						}
					: { message: error instanceof Error ? error.message : String(error) };
			debug("github-star", "GitHub API error", {
				target,
				...errMeta,
			});
			console.error("[github-star] GitHub API error", {
				target,
				starred: data.starred,
				...errMeta,
			});
			return toMutationError(
				data.starred ? "star repository" : "unstar repository",
				error,
			);
		}
	});

export type ForkRepoInput = {
	owner: string;
	repo: string;
};

export type ForkRepoResult =
	| { ok: true; forkOwner: string; forkName: string; htmlUrl: string }
	| MutationFailure;

export const forkRepository = createServerFn({ method: "POST" })
	.validator(identityValidator<ForkRepoInput>)
	.handler(async ({ data }): Promise<ForkRepoResult> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return { ok: false, error: "Not authenticated" };
		}

		try {
			const response = await context.octokit.rest.repos.createFork({
				owner: data.owner,
				repo: data.repo,
			});

			return {
				ok: true,
				forkOwner: response.data.owner.login,
				forkName: response.data.name,
				htmlUrl: response.data.html_url,
			};
		} catch (error) {
			return toMutationError("fork repository", error);
		}
	});
