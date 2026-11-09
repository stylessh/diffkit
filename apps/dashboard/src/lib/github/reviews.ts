import { createServerFn } from "@tanstack/react-start";
import type {
	CreateReviewCommentInput,
	OrgTeam,
	PullReviewComment,
	ReplyToReviewCommentInput,
	RepoCollaborator,
	RequestReviewersInput,
	ReviewThreadInfo,
	SubmitReviewInput,
} from "../github.types";
import { getGitHubAppSlug } from "../github-app.server";
import {
	fetchPaginatedGitHubResource,
	listPaginatedGitHubItems,
	withGitHubOperationTimeout,
} from "./client";
import {
	getGitHubContextForOwner,
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
	repositoryMatchesInstallationRepository,
} from "./installations";
import { mapActor, restEditedAt } from "./mappers";
import { dedupeGitHubRead } from "./request-dedup";
import {
	GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
	type GitHubApiUser,
	type GitHubClient,
	type GitHubContext,
	type GitHubInstallationAccountPayload,
	type GitHubInstallationRepositoriesPayload,
	type MutationResult,
	normalizeLogin,
	type PullFromRepoInput,
	toMutationError,
} from "./shared";
import { identityValidator } from "./validators";

type RepoPullReviewComment = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["listReviewComments"]>
>["data"][number];

type GitHubReviewerBotInstallationPayload = {
	id?: number;
	account?: GitHubInstallationAccountPayload | null;
	repository_selection?: string;
	target_type?: string;
	permissions?: Record<string, string | undefined>;
	app_slug?: string;
	suspended_at?: string | null;
};

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
		const { getGitHubAppUserClientByUserId } = await import("../auth-runtime");
		const appUserOctokit = await getGitHubAppUserClientByUserId(
			context.session.user.id,
		);
		if (!appUserOctokit) {
			return false;
		}

		const repositories = await listPaginatedGitHubItems({
			request: (page) =>
				appUserOctokit.rest.apps.listInstallationReposForAuthenticatedUser({
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
	return dedupeGitHubRead<RepoCollaborator[]>({
		userId: context.session.user.id,
		resource: "repos.reviewerBots",
		params,
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

			return mergeReviewerCandidates([], bots);
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

async function getPullReviewCommentsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullReviewComment[]> {
	return fetchPaginatedGitHubResource<
		RepoPullReviewComment,
		PullReviewComment[]
	>({
		context,
		resource: "pulls.reviewComments",
		params: data,
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
				editedAt: restEditedAt(comment),
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
	.validator(identityValidator<PullFromRepoInput>)
	.handler(async ({ data }): Promise<PullReviewComment[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getPullReviewCommentsResult(context, data);
	});

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
	.validator(identityValidator<PullFromRepoInput>)
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

export type ResolveThreadInput = {
	owner: string;
	repo: string;
	threadId: string;
};

export const resolveReviewThread = createServerFn({ method: "POST" })
	.validator(identityValidator<ResolveThreadInput>)
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
	.validator(identityValidator<ResolveThreadInput>)
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
	.validator(identityValidator<SubmitReviewInput>)
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
			return true;
		} catch (error) {
			console.error("[submitPullReview] Failed:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(message);
		}
	});

export const createReviewComment = createServerFn({ method: "POST" })
	.validator(identityValidator<CreateReviewCommentInput>)
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
				editedAt: restEditedAt(comment),
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
	.validator(identityValidator<ReplyToReviewCommentInput>)
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
				editedAt: restEditedAt(comment),
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
	.validator(identityValidator<RepoCollaboratorsInput>)
	.handler(async ({ data }): Promise<RepoCollaborator[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		const collaboratorsPromise = fetchPaginatedGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["repos"]["listCollaborators"]>
			>["data"][number],
			RepoCollaborator[]
		>({
			context,
			resource: "repos.collaborators",
			params: data,
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
	.validator(identityValidator<OrgTeamsInput>)
	.handler(async ({ data }): Promise<OrgTeam[]> => {
		const context = await getGitHubContextForOwner(data.org);
		if (!context) {
			return [];
		}

		const teams = await fetchPaginatedGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["teams"]["list"]>
			>["data"][number],
			OrgTeam[]
		>({
			context,
			resource: "org.teams",
			params: data,
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
	.validator(identityValidator<RequestReviewersInput>)
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
			return { ok: true };
		} catch (error) {
			return toMutationError("request reviewers", error);
		}
	});

export const removeReviewRequest = createServerFn({ method: "POST" })
	.validator(identityValidator<RequestReviewersInput>)
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
	.validator(identityValidator<DismissReviewInput>)
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
			return { ok: true };
		} catch (error) {
			return toMutationError("dismiss review", error);
		}
	});
