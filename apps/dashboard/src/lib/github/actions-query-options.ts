import { queryOptions } from "@tanstack/react-query";
import {
	getWorkflowDefinition,
	getWorkflowJobLogs,
	getWorkflowRun,
	getWorkflowRunLogsBundle,
	getWorkflowRunsForRepo,
	listWorkflowRunArtifacts,
	listWorkflowRunJobs,
} from "../github.functions";
import { githubCacheTimes } from "../github-cache-policy";
import {
	adaptiveRefetchInterval,
	classifyWorkflowJobs,
	classifyWorkflowRun,
} from "../github-refetch-policy";
import {
	type GitHubQueryScope,
	githubQueryKeys,
	type WorkflowDefinitionQueryInput,
	type WorkflowJobLogsQueryInput,
	type WorkflowRunLogsBundleQueryInput,
	type WorkflowRunQueryInput,
	type WorkflowRunsFromRepoQueryInput,
} from "./query-keys";

export function githubWorkflowRunsFromRepoQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunsFromRepoQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.runsList(scope, input),
		queryFn: () => getWorkflowRunsForRepo({ data: input }),
		...githubCacheTimes("workflowRun"),
	});
}

export function githubWorkflowRunQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowRun(scope, input),
		queryFn: () => getWorkflowRun({ data: input }),
		...githubCacheTimes("workflowRun"),
		refetchInterval: adaptiveRefetchInterval(classifyWorkflowRun),
		refetchIntervalInBackground: false,
	});
}

export function githubWorkflowRunJobsQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowRunJobs(scope, input),
		queryFn: () => listWorkflowRunJobs({ data: input }),
		...githubCacheTimes("workflowRun"),
		refetchInterval: adaptiveRefetchInterval(classifyWorkflowJobs),
		refetchIntervalInBackground: false,
	});
}

export function githubWorkflowRunArtifactsQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowRunArtifacts(scope, input),
		queryFn: () => listWorkflowRunArtifacts({ data: input }),
		...githubCacheTimes("workflowRun"),
	});
}

export function githubWorkflowDefinitionQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowDefinitionQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowDefinition(scope, input),
		queryFn: () => getWorkflowDefinition({ data: input }),
		...githubCacheTimes("detail"),
	});
}

export function githubWorkflowJobLogsQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowJobLogsQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowJobLogs(scope, input),
		queryFn: () => getWorkflowJobLogs({ data: input }),
		staleTime: 2 * 1000,
		gcTime: 60 * 1000,
	});
}

/**
 * Bundle of per-step logs derived from the run-level zip.
 *
 * Only meaningful for completed runs — the `/actions/runs/{runId}/logs`
 * endpoint returns 404 / 410 (mapped to `notAvailable: true`) until the run
 * finishes. Once completed, the data is immutable, so we cache aggressively.
 */
export function githubWorkflowRunLogsBundleQueryOptions(
	scope: GitHubQueryScope,
	input: WorkflowRunLogsBundleQueryInput,
) {
	return queryOptions({
		queryKey: githubQueryKeys.actions.workflowRunLogsBundle(scope, input),
		queryFn: () => getWorkflowRunLogsBundle({ data: input }),
		staleTime: 60 * 60 * 1000,
		gcTime: 4 * 60 * 60 * 1000,
	});
}
