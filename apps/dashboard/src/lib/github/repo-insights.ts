import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import type {
	DiscussionsResult,
	RepoContributorsResult,
	RepoParticipationStats,
} from "../github.types";
import { executeGitHubGraphQL } from "./client";
import { getGitHubContextForRepository } from "./installations";
import { dedupeGitHubRead } from "./request-dedup";
import { identityValidator } from "./validators";

type RepoOverviewInput = {
	owner: string;
	repo: string;
};

export const getRepoParticipationStats = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoOverviewInput>)
	.handler(async ({ data }): Promise<RepoParticipationStats> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return { weeklyCommits: [] };
		}

		return dedupeGitHubRead<RepoParticipationStats>({
			userId: context.session.user.id,
			resource: "repos.participationStats",
			params: data,
			fetcher: async () => {
				const maxAttempts = 6;
				const retryDelayMs = 1_500;

				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					try {
						const response =
							await context.octokit.rest.repos.getParticipationStats({
								owner: data.owner,
								repo: data.repo,
							});

						const weeklyCommits = Array.isArray(response.data?.all)
							? response.data.all
							: [];

						return { weeklyCommits };
					} catch (error) {
						if (error instanceof RequestError && error.status === 202) {
							if (attempt < maxAttempts - 1) {
								await new Promise((resolve) =>
									setTimeout(resolve, retryDelayMs),
								);
								continue;
							}
							throw error;
						}

						if (error instanceof RequestError) {
							if (error.status === 404 || error.status === 403) {
								return { weeklyCommits: [] };
							}
						}

						throw error;
					}
				}

				throw new Error("participation stats: exhausted 202 retries");
			},
		});
	});

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
	.validator(identityValidator<RepoDiscussionsInput>)
	.handler(async ({ data }): Promise<DiscussionsResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { discussions: [], totalCount: 0 };

		return dedupeGitHubRead<DiscussionsResult>({
			userId: context.session.user.id,
			resource: "repo.discussions.v1",
			params: {
				owner: data.owner,
				repo: data.repo,
				first: data.first ?? 5,
			},
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
					};
				} catch (error) {
					if (
						error instanceof RequestError &&
						(error.status === 403 || error.status === 429)
					) {
						throw error;
					}

					return { discussions: [], totalCount: 0 };
				}
			},
		});
	});

function parseLinkHeaderLastPage(link: string | undefined): number | null {
	if (!link) return null;
	const match = link.match(/[&?]page=(\d+)[^>]*>;\s*rel="last"/);
	return match ? Number(match[1]) : null;
}

type RepoContributorsInput = {
	owner: string;
	repo: string;
};

export const getRepoContributors = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoContributorsInput>)
	.handler(async ({ data }): Promise<RepoContributorsResult> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return { contributors: [], totalCount: 0 };

		return dedupeGitHubRead<RepoContributorsResult>({
			userId: context.session.user.id,
			resource: "repo.contributors.v1",
			params: data,
			fetcher: async () => {
				const response = await context.octokit.rest.repos.listContributors({
					owner: data.owner,
					repo: data.repo,
					per_page: 30,
					anon: "false",
				});
				const totalCount =
					parseLinkHeaderLastPage(
						response.headers.link as string | undefined,
					) ?? response.data.length;

				return {
					contributors: response.data
						.filter((c): c is typeof c & { login: string } => !!c.login)
						.map((c) => ({
							login: c.login,
							avatarUrl: c.avatar_url ?? "",
							contributions: c.contributions ?? 0,
						})),
					totalCount,
				};
			},
		});
	});
