import type { RepoCollaborator } from "../github.types";
import { getGitHubAppSlug } from "../github-app.server";
import { listPaginatedGitHubItems, withGitHubOperationTimeout } from "./client";
import {
	listInstallationRepositories,
	repositoryMatchesInstallationRepository,
} from "./installations";
import { mapActor } from "./mappers";
import { dedupeGitHubRead } from "./request-dedup";
import {
	GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
	type GitHubApiUser,
	type GitHubContext,
	type GitHubInstallationAccountPayload,
	normalizeLogin,
	type RepositoryInput,
} from "./shared";

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

export function mergeReviewerCandidates(
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

export function isOwnGitHubAppBot(login: string) {
	const appSlug = getGitHubAppSlug();
	return appSlug !== null && normalizeLogin(login) === `${appSlug}[bot]`;
}

export function isReviewerCandidate(candidate: RepoCollaborator) {
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
	params: RepositoryInput,
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

		const repositories = await listInstallationRepositories(
			appUserOctokit,
			installation.id,
		);

		return repositories.some((repository) =>
			repositoryMatchesInstallationRepository(repository, params),
		);
	} catch {
		return false;
	}
}

function listableInstallations(payload: unknown) {
	return (
		(payload as { installations?: GitHubReviewerBotInstallationPayload[] })
			.installations ?? []
	).filter((installation) => typeof installation.id === "number");
}

/**
 * Not every user can list an org's app installations, and reviewer bots are
 * additive, so either source may fail without hiding people or teams.
 */
async function listReviewerBotInstallations(
	context: GitHubContext,
	params: RepositoryInput,
) {
	const [orgInstallations, userInstallations] = await Promise.all([
		listPaginatedGitHubItems({
			request: (page) =>
				context.octokit.rest.orgs.listAppInstallations({
					org: params.owner,
					page,
					per_page: 100,
				}),
			getItems: listableInstallations,
		}).catch((): GitHubReviewerBotInstallationPayload[] => []),
		listPaginatedGitHubItems({
			request: (page) =>
				context.octokit.rest.apps.listInstallationsForAuthenticatedUser({
					page,
					per_page: 100,
				}),
			getItems: listableInstallations,
		}).catch((): GitHubReviewerBotInstallationPayload[] => []),
	]);

	const byId = new Map<number, GitHubReviewerBotInstallationPayload>();
	for (const installation of [...orgInstallations, ...userInstallations]) {
		if (installation.id) {
			byId.set(installation.id, installation);
		}
	}
	return Array.from(byId.values());
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

export async function getRepoReviewerBots(
	context: GitHubContext,
	params: RepositoryInput,
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
					const ownAppSlug = getGitHubAppSlug();
					const candidates = installations.filter(
						(installation) =>
							installation.app_slug !== ownAppSlug &&
							installationCanReviewPullRequests(installation),
					);
					const hasAccess = await Promise.all(
						candidates.map((installation) =>
							installationHasRepositoryAccess(context, installation, params),
						),
					);
					const matchingInstallations = candidates.filter(
						(_, index) => hasAccess[index],
					);

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
