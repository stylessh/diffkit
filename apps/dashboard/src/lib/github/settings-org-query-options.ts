import { queryOptions } from "@tanstack/react-query";
import {
	getOrgMembers,
	getOrgSettings,
	getOrgTeamList,
	getOrgTeamMembers,
	getOrgViewerRole,
	getViewerOrganizations,
} from "../github.functions";
import { githubCachePolicy } from "../github-cache-policy";
import { type GitHubQueryScope, githubQueryKeys } from "./query-keys";

type OrgInput = { org: string };

const policy = githubCachePolicy.settings;

export function githubOrgSettingsQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.general(scope, input),
		queryFn: () => getOrgSettings({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubOrgViewerRoleQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.role(scope, input),
		queryFn: () => getOrgViewerRole({ data: input }),
		staleTime: githubCachePolicy.repoMeta.staleTimeMs,
		gcTime: githubCachePolicy.repoMeta.gcTimeMs,
	});
}

export function githubOrgMembersQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.members(scope, input),
		queryFn: () => getOrgMembers({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubOrgTeamListQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.teams(scope, input),
		queryFn: () => getOrgTeamList({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubOrgTeamMembersQueryOptions(
	scope: GitHubQueryScope,
	input: OrgInput & { teamSlug: string },
) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.teamMembers(scope, input),
		queryFn: () => getOrgTeamMembers({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubViewerOrganizationsQueryOptions(scope: GitHubQueryScope) {
	return queryOptions({
		queryKey: githubQueryKeys.orgSettings.viewerOrgs(scope),
		queryFn: () => getViewerOrganizations(),
		staleTime: githubCachePolicy.reposList.staleTimeMs,
		gcTime: githubCachePolicy.reposList.gcTimeMs,
	});
}
