import { createFileRoute } from "@tanstack/react-router";
import { WorkflowJobPage } from "#/components/workflows/workflow-job-page";
import {
	githubViewerQueryOptions,
	githubWorkflowJobLogsQueryOptions,
	githubWorkflowRunJobsQueryOptions,
	githubWorkflowRunLogsBundleQueryOptions,
	githubWorkflowRunQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

export const Route = createFileRoute(
	"/_protected/$owner/$repo/actions/runs/$runId_/job/$jobId",
)({
	ssr: false,
	loader: ({ context, params }) => {
		const runId = Number(params.runId);
		const jobId = Number(params.jobId);
		const scope = { userId: context.user.id };
		const runInput = { owner: params.owner, repo: params.repo, runId };

		const runOptions = githubWorkflowRunQueryOptions(scope, runInput);
		void context.queryClient.prefetchQuery(runOptions);
		void context.queryClient.prefetchQuery(
			githubWorkflowRunJobsQueryOptions(scope, runInput),
		);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));

		const cachedRun = context.queryClient.getQueryData(runOptions.queryKey);
		if (cachedRun?.status === "completed") {
			void context.queryClient.prefetchQuery(
				githubWorkflowRunLogsBundleQueryOptions(scope, {
					...runInput,
					attempt: cachedRun.runAttempt,
				}),
			);
		} else {
			void context.queryClient.prefetchQuery(
				githubWorkflowJobLogsQueryOptions(scope, {
					owner: params.owner,
					repo: params.repo,
					jobId,
				}),
			);
		}

		const jobsKey = githubWorkflowRunJobsQueryOptions(scope, runInput).queryKey;
		const cachedJobs = context.queryClient.getQueryData(jobsKey);
		const cachedJob = cachedJobs?.find((j) => j.id === jobId) ?? null;
		return {
			jobName: cachedJob?.name ?? null,
		};
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(
				match.loaderData?.jobName ?? `Job #${params.jobId}`,
			),
			description: `Workflow job #${params.jobId} in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: WorkflowJobPage,
});
