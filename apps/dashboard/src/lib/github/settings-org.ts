import { createServerFn } from "@tanstack/react-start";
import {
	type Invitee,
	mapOrgInvitation,
	mapOrgMembers,
	mapOrgSettings,
	mapOrgTeam,
	mapTeamMembers,
	type OrgMembers,
	type OrgProfileDraft,
	type OrgRole,
	type OrgSettings,
	type OrgTeamDraft,
	type OrgTeamMember,
	type OrgTeamSummary,
	type TeamRole,
	toOrgApiPatch,
	validateOrgTeamDraft,
} from "../settings/org";
import type { SettingsOutcome, SettingsRead } from "../settings/read-result";
import { readSettings, runSettingsMutation } from "./settings-server";
import { identityValidator } from "./validators";

type OrgInput = { org: string };

function invitationRole(role: OrgRole) {
	return role === "admin" ? "admin" : "direct_member";
}

export type ViewerOrg = { login: string; avatarUrl: string };

export const getViewerOrganizations = createServerFn({ method: "GET" }).handler(
	(): Promise<SettingsRead<ViewerOrg[]>> =>
		readSettings("organizations", async (octokit) => {
			const orgs = await octokit.paginate(
				octokit.rest.orgs.listForAuthenticatedUser,
				{ per_page: 100 },
			);
			return orgs.map((org) => ({
				login: org.login,
				avatarUrl: org.avatar_url,
			}));
		}),
);

export const getOrgSettings = createServerFn({ method: "GET" })
	.validator(identityValidator<OrgInput>)
	.handler(
		({ data }): Promise<SettingsRead<OrgSettings>> =>
			readSettings("organization", async (octokit) => {
				const response = await octokit.rest.orgs.get({ org: data.org });
				return mapOrgSettings(response.data);
			}),
	);

export const getOrgViewerRole = createServerFn({ method: "GET" })
	.validator(identityValidator<OrgInput>)
	.handler(
		({ data }): Promise<SettingsRead<OrgRole | null>> =>
			readSettings("membership", async (octokit) => {
				const response =
					await octokit.rest.orgs.getMembershipForAuthenticatedUser({
						org: data.org,
					});
				if (response.data.state !== "active") return null;
				return response.data.role === "admin" ? "admin" : "member";
			}),
	);

export const updateOrgSettings = createServerFn({ method: "POST" })
	.validator(
		identityValidator<OrgInput & { changes: Partial<OrgProfileDraft> }>,
	)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("save organization settings", (octokit) =>
				octokit.request("PATCH /orgs/{org}", {
					org: data.org,
					...toOrgApiPatch(data.changes),
				}),
			),
	);

export const getOrgMembers = createServerFn({ method: "GET" })
	.validator(identityValidator<OrgInput>)
	.handler(
		({ data }): Promise<SettingsRead<OrgMembers>> =>
			readSettings("members", async (octokit) => {
				const [members, admins, invitations] = await Promise.all([
					octokit.paginate(octokit.rest.orgs.listMembers, {
						org: data.org,
						per_page: 100,
					}),
					octokit.paginate(octokit.rest.orgs.listMembers, {
						org: data.org,
						role: "admin",
						per_page: 100,
					}),
					octokit
						.paginate(octokit.rest.orgs.listPendingInvitations, {
							org: data.org,
							per_page: 100,
						})
						.catch(() => []),
				]);
				return {
					members: mapOrgMembers(members, admins),
					invitations: invitations.flatMap(
						(invitation) => mapOrgInvitation(invitation) ?? [],
					),
				};
			}),
	);

export const setOrgMemberRole = createServerFn({ method: "POST" })
	.validator(identityValidator<OrgInput & { login: string; role: OrgRole }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("change the role", (octokit) =>
				octokit.rest.orgs.setMembershipForUser({
					org: data.org,
					username: data.login,
					role: data.role,
				}),
			),
	);

export const removeOrgMember = createServerFn({ method: "POST" })
	.validator(identityValidator<OrgInput & { login: string }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("remove the member", (octokit) =>
				octokit.rest.orgs.removeMember({
					org: data.org,
					username: data.login,
				}),
			),
	);

export const inviteOrgMember = createServerFn({ method: "POST" })
	.validator(identityValidator<OrgInput & { invitee: Invitee; role: OrgRole }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("send the invitation", async (octokit) => {
				const invitee = data.invitee;
				if (invitee.kind === "email") {
					await octokit.rest.orgs.createInvitation({
						org: data.org,
						email: invitee.email,
						role: invitationRole(data.role),
					});
					return;
				}
				const user = await octokit.rest.users.getByUsername({
					username: invitee.login,
				});
				await octokit.rest.orgs.createInvitation({
					org: data.org,
					invitee_id: user.data.id,
					role: invitationRole(data.role),
				});
			}),
	);

export const cancelOrgInvitation = createServerFn({ method: "POST" })
	.validator(identityValidator<OrgInput & { invitationId: number }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("cancel the invitation", (octokit) =>
				octokit.rest.orgs.cancelInvitation({
					org: data.org,
					invitation_id: data.invitationId,
				}),
			),
	);

export const getOrgTeamList = createServerFn({ method: "GET" })
	.validator(identityValidator<OrgInput>)
	.handler(
		({ data }): Promise<SettingsRead<OrgTeamSummary[]>> =>
			readSettings("teams", async (octokit) => {
				const teams = await octokit.paginate(octokit.rest.teams.list, {
					org: data.org,
					per_page: 100,
				});
				return teams.map(mapOrgTeam);
			}),
	);

export const saveOrgTeam = createServerFn({ method: "POST" })
	.validator(
		identityValidator<
			OrgInput & { currentSlug: string | null; draft: OrgTeamDraft }
		>,
	)
	.handler(({ data }): Promise<SettingsOutcome> => {
		const problem = validateOrgTeamDraft(data.draft, []);
		if (problem) return Promise.resolve({ ok: false, error: problem });
		const body = {
			name: data.draft.name.trim(),
			description: data.draft.description.trim(),
			privacy: data.draft.privacy,
		};
		return runSettingsMutation("save the team", (octokit) =>
			data.currentSlug === null
				? octokit.rest.teams.create({ org: data.org, ...body })
				: octokit.rest.teams.updateInOrg({
						org: data.org,
						team_slug: data.currentSlug,
						...body,
					}),
		);
	});

export const deleteOrgTeam = createServerFn({ method: "POST" })
	.validator(identityValidator<OrgInput & { teamSlug: string }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("delete the team", (octokit) =>
				octokit.rest.teams.deleteInOrg({
					org: data.org,
					team_slug: data.teamSlug,
				}),
			),
	);

export const getOrgTeamMembers = createServerFn({ method: "GET" })
	.validator(identityValidator<OrgInput & { teamSlug: string }>)
	.handler(
		({ data }): Promise<SettingsRead<OrgTeamMember[]>> =>
			readSettings("team members", async (octokit) => {
				const params = {
					org: data.org,
					team_slug: data.teamSlug,
					per_page: 100,
				};
				const [members, maintainers] = await Promise.all([
					octokit.paginate(octokit.rest.teams.listMembersInOrg, params),
					octokit.paginate(octokit.rest.teams.listMembersInOrg, {
						...params,
						role: "maintainer",
					}),
				]);
				return mapTeamMembers(members, maintainers);
			}),
	);

export const setOrgTeamMember = createServerFn({ method: "POST" })
	.validator(
		identityValidator<
			OrgInput & { teamSlug: string; login: string; role: TeamRole }
		>,
	)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("update the team member", (octokit) =>
				octokit.rest.teams.addOrUpdateMembershipForUserInOrg({
					org: data.org,
					team_slug: data.teamSlug,
					username: data.login,
					role: data.role,
				}),
			),
	);

export const removeOrgTeamMember = createServerFn({ method: "POST" })
	.validator(identityValidator<OrgInput & { teamSlug: string; login: string }>)
	.handler(
		({ data }): Promise<SettingsOutcome> =>
			runSettingsMutation("remove the team member", (octokit) =>
				octokit.rest.teams.removeMembershipForUserInOrg({
					org: data.org,
					team_slug: data.teamSlug,
					username: data.login,
				}),
			),
	);
