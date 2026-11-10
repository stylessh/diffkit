import { createServerFn } from "@tanstack/react-start";
import type {
	OrgTeam,
	RepoCollaborator,
	RequestReviewersInput,
} from "../github.types";
import {
	fetchPaginatedGitHubResource,
	withGitHubOperationTimeout,
} from "./client";
import {
	getGitHubContextForOwner,
	getGitHubContextForRepository,
} from "./installations";
import { mutateRepository } from "./mutations";
import {
	getRepoReviewerBots,
	isOwnGitHubAppBot,
	isReviewerCandidate,
	mergeReviewerCandidates,
} from "./reviewer-candidates";
import {
	GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
	type GitHubClient,
	type GitHubContext,
	type MutationResult,
} from "./shared";
import { identityValidator } from "./validators";

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
		const botsPromise = getRepoReviewerBots(context, data).catch(() => []);

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
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(data, "request reviewers", (context) =>
				context.octokit.rest.pulls.requestReviewers({
					owner: data.owner,
					repo: data.repo,
					pull_number: data.pullNumber,
					reviewers: data.reviewers ?? [],
					team_reviewers: data.teamReviewers ?? [],
				}),
			),
	);

export const removeReviewRequest = createServerFn({ method: "POST" })
	.validator(identityValidator<RequestReviewersInput>)
	.handler(
		({ data }): Promise<MutationResult> =>
			mutateRepository(data, "remove review request", (context) =>
				context.octokit.rest.pulls.removeRequestedReviewers({
					owner: data.owner,
					repo: data.repo,
					pull_number: data.pullNumber,
					reviewers: data.reviewers ?? [],
					team_reviewers: data.teamReviewers ?? [],
				}),
			),
	);
