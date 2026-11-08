import { queryOptions } from "@tanstack/react-query";
import {
	getRepoAccess,
	getRepoActionsSecrets,
	getRepoActionsVariables,
	getRepoBranchProtections,
	getRepoGeneralSettings,
	getRepoRulesets,
	getRepoWebhooks,
	getWebhookDeliveries,
} from "../github.functions";
import { githubCachePolicy } from "../github-cache-policy";
import { type GitHubQueryScope, githubQueryKeys } from "./query-keys";

type RepoInput = { owner: string; repo: string };

const policy = githubCachePolicy.settings;

export function githubRepoGeneralSettingsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.general(scope, input),
		queryFn: () => getRepoGeneralSettings({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubRepoRulesetsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.rulesets(scope, input),
		queryFn: () => getRepoRulesets({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubRepoBranchProtectionsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.protections(scope, input),
		queryFn: () => getRepoBranchProtections({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubRepoAccessQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.access(scope, input),
		queryFn: () => getRepoAccess({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubRepoWebhooksQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.webhooks(scope, input),
		queryFn: () => getRepoWebhooks({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubRepoWebhookDeliveriesQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput & { hookId: number },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.webhookDeliveries(scope, input),
		queryFn: () => getWebhookDeliveries({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubRepoActionsSecretsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.actionsSecrets(scope, input),
		queryFn: () => getRepoActionsSecrets({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}

export function githubRepoActionsVariablesQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.actionsVariables(scope, input),
		queryFn: () => getRepoActionsVariables({ data: input }),
		staleTime: policy.staleTimeMs,
		gcTime: policy.gcTimeMs,
	});
}
