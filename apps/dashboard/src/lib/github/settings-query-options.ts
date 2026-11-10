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
import { githubCacheTimes } from "../github-cache-policy";
import { type GitHubQueryScope, githubQueryKeys } from "./query-keys";

type RepoInput = { owner: string; repo: string };

export function githubRepoGeneralSettingsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.general(scope, input),
		queryFn: () => getRepoGeneralSettings({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubRepoRulesetsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.rulesets(scope, input),
		queryFn: () => getRepoRulesets({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubRepoBranchProtectionsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.protections(scope, input),
		queryFn: () => getRepoBranchProtections({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubRepoAccessQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.access(scope, input),
		queryFn: () => getRepoAccess({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubRepoWebhooksQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.webhooks(scope, input),
		queryFn: () => getRepoWebhooks({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubRepoWebhookDeliveriesQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput & { hookId: number },
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.webhookDeliveries(scope, input),
		queryFn: () => getWebhookDeliveries({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubRepoActionsSecretsQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.actionsSecrets(scope, input),
		queryFn: () => getRepoActionsSecrets({ data: input }),
		...githubCacheTimes("settings"),
	});
}

export function githubRepoActionsVariablesQueryOptions(
	scope: GitHubQueryScope,
	input: RepoInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.repoSettings.actionsVariables(scope, input),
		queryFn: () => getRepoActionsVariables({ data: input }),
		...githubCacheTimes("settings"),
	});
}
