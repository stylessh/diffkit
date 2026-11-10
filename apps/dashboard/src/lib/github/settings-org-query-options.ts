import { queryOptions } from "@tanstack/react-query";
import {
	getOrgMembers,
	getOrgSettings,
	getOrgTeamList,
	getOrgTeamMembers,
	getOrgViewerRole,
	getViewerOrganizations,
} from "../github.functions";
import { githubCacheTimes } from "../github-cache-policy";
import { type GitHubQueryScope, githubQueryKeys } from "./query-keys";

type OrgInput = { org: string };

export function githubOrgSettingsQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.general(scope, input),
		queryFn: () => getOrgSettings({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubOrgViewerRoleQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.role(scope, input),
		queryFn: () => getOrgViewerRole({ data: input }),
		...githubCacheTimes("repoMeta"),
	});
}

export function githubOrgMembersQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.members(scope, input),
		queryFn: () => getOrgMembers({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubOrgTeamListQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.teams(scope, input),
		queryFn: () => getOrgTeamList({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubOrgTeamMembersQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput & { teamSlug: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.teamMembers(scope, input),
		queryFn: () => getOrgTeamMembers({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubViewerOrganizationsQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.viewerOrgs(scope),
		queryFn: () => getViewerOrganizations(),
		...githubCacheTimes("reposList"),
	});
}
