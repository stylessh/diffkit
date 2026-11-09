import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import { debug } from "../debug";
import type {
	ContributionDay,
	ContributionWeek,
	GitHubContributionCalendar,
	GitHubUserProfile,
	PinnedRepo,
	UserActivityEvent,
} from "../github.types";
import { isRepoVisibleWithInstallationAccess } from "../github-access";
import { executeGitHubGraphQL, getGitHubContext } from "./client";
import { getInstallationAccessIndex } from "./installations";
import { identityValidator } from "./validators";

export type UserProfileInput = { username: string };

export const getUserProfile = createServerFn({ method: "GET" })
	.validator(identityValidator<UserProfileInput>)
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
	.validator(identityValidator<UserProfileInput>)
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
	.validator(identityValidator<UserProfileInput>)
	.handler(async ({ data }): Promise<PinnedRepo[]> => {
		const context = await getGitHubContext();
		if (!context) {
			return [];
		}

		const accessIndex = await getInstallationAccessIndex(context);

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

			const allPinned = response.user.pinnedItems.nodes;
			const visiblePinned = allPinned.filter((repo) =>
				isRepoVisibleWithInstallationAccess(
					accessIndex,
					repo.owner.login,
					repo.name,
					repo.isPrivate,
				),
			);

			const removedCount = allPinned.length - visiblePinned.length;
			if (removedCount > 0) {
				debug("installation-access", "getUserPinnedRepos filtered", {
					total: allPinned.length,
					kept: visiblePinned.length,
					removed: removedCount,
					removedRepos: allPinned
						.filter(
							(repo) =>
								!isRepoVisibleWithInstallationAccess(
									accessIndex,
									repo.owner.login,
									repo.name,
									repo.isPrivate,
								),
						)
						.map((repo) => `${repo.owner.login}/${repo.name}`),
				});
			}

			return visiblePinned.map((repo) => ({
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
	.validator(identityValidator<UserActivityInput>)
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
