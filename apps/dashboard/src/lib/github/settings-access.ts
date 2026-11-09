import { createServerFn } from "@tanstack/react-start";
import {
	mapCollaborator,
	mapInvitation,
	mapRepoTeam,
	type RepoAccess,
	type RepoCollaborator,
	type RepoRole,
	sortCollaborators,
	toApiPermission,
} from "../settings/access";
import type { SettingsOutcome, SettingsRead } from "../settings/read-result";
import { readSettings, runSettingsMutation } from "./settings-server";
import { identityValidator } from "./validators";

type RepoInput = { owner: string; repo: string };

export const getRepoAccess = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoInput>)
	.handler(
		({ data }): Promise<SettingsRead<RepoAccess>> =>
			readSettings("collaborators", async (octokit) => {
				const [people, invitations, teams] = await Promise.all([
					octokit.paginate(octokit.rest.repos.listCollaborators, {
						...data,
						affiliation: "direct",
						per_page: 100,
					}),
					octokit.paginate(octokit.rest.repos.listInvitations, {
						...data,
						per_page: 100,
					}),
					octokit
						.paginate(octokit.rest.repos.listTeams, {
							...data,
							per_page: 100,
						})
						.then(
							(rows) => rows,
							() => null,
						),
				]);
				const collaborators: RepoCollaborator[] = [
					...people.map(mapCollaborator),
					...invitations.flatMap((invite) => mapInvitation(invite) ?? []),
				];
				const withAccess = new Set((teams ?? []).map((team) => team.slug));
				const orgTeams =
					teams === null
						? []
						: await octokit
								.paginate(octokit.rest.teams.list, {
									org: data.owner,
									per_page: 100,
								})
								.catch(() => []);
				return {
					collaborators: sortCollaborators(collaborators),
					teams: (teams ?? []).map(mapRepoTeam),
					teamsAvailable: teams !== null,
					addableTeams: orgTeams
						.filter((team) => !withAccess.has(team.slug))
						.map((team) => ({ slug: team.slug, name: team.name })),
				};
			}),
	);

export const setRepoCollaboratorRole = createServerFn({ method: "POST" })
	.validator(
		identityValidator<
			RepoInput & { login: string; role: RepoRole; invitationId: number | null }
		>,
	)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("change access", (octokit) =>
				data.invitationId === null
					? octokit.rest.repos.addCollaborator({
							owner: data.owner,
							repo: data.repo,
							username: data.login,
							permission: toApiPermission(data.role),
						})
					: octokit.rest.repos.updateInvitation({
							owner: data.owner,
							repo: data.repo,
							invitation_id: data.invitationId,
							permissions: data.role,
						}),
			),
	);

export const removeRepoCollaborator = createServerFn({ method: "POST" })
	.validator(
		identityValidator<
			RepoInput & { login: string; invitationId: number | null }
		>,
	)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("remove access", (octokit) =>
				data.invitationId === null
					? octokit.rest.repos.removeCollaborator({
							owner: data.owner,
							repo: data.repo,
							username: data.login,
						})
					: octokit.rest.repos.deleteInvitation({
							owner: data.owner,
							repo: data.repo,
							invitation_id: data.invitationId,
						}),
			),
	);

export const setRepoTeamRole = createServerFn({ method: "POST" })
	.validator(
		identityValidator<RepoInput & { teamSlug: string; role: RepoRole }>,
	)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("change team access", (octokit) =>
				octokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
					org: data.owner,
					team_slug: data.teamSlug,
					owner: data.owner,
					repo: data.repo,
					permission: toApiPermission(data.role),
				}),
			),
	);

export const removeRepoTeam = createServerFn({ method: "POST" })
	.validator(identityValidator<RepoInput & { teamSlug: string }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("remove team access", (octokit) =>
				octokit.rest.teams.removeRepoInOrg({
					org: data.owner,
					team_slug: data.teamSlug,
					owner: data.owner,
					repo: data.repo,
				}),
			),
	);
