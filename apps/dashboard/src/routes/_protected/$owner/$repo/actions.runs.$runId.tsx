import { createFileRoute } from "@tanstack/react-router";
import { WorkflowRunPage } from "#/components/workflows/workflow-run-page";
import {
	githubViewerQueryOptions,
	githubWorkflowDefinitionQueryOptions,
	githubWorkflowRunArtifactsQueryOptions,
	githubWorkflowRunJobsQueryOptions,
	githubWorkflowRunQueryOptions,
} from "#/lib/github.query";
import { buildSeo, formatPageTitle } from "#/lib/seo";

type WorkflowRunSearch = {
	pr?: number;
};

export const Route = createFileRoute(
	"/_protected/$owner/$repo/actions/runs/$runId",
)({
	ssr: false,
	validateSearch: (search: Record<string, unknown>): WorkflowRunSearch => {
		const raw = search.pr;
		const parsed =
			typeof raw === "number"
				? raw
				: typeof raw === "string"
					? Number(raw)
					: Number.NaN;
		return Number.isInteger(parsed) && parsed > 0 ? { pr: parsed } : {};
	},
	loader: ({ context, params }) => {
		const runId = Number(params.runId);
		if (!Number.isInteger(runId) || runId <= 0) {
			return { runTitle: null };
		}
		const scope = { userId: context.user.id };
		const input = { owner: params.owner, repo: params.repo, runId };

		const runOptions = githubWorkflowRunQueryOptions(scope, input);
		void context.queryClient
			.ensureQueryData(runOptions)
			.then((run) => {
				if (!run) return;
				void context.queryClient.prefetchQuery(
					githubWorkflowDefinitionQueryOptions(scope, {
						owner: params.owner,
						repo: params.repo,
						path: run.path,
						ref: run.headSha,
					}),
				);
			})
			.catch(() => {});
		void context.queryClient.prefetchQuery(
			githubWorkflowRunJobsQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(
			githubWorkflowRunArtifactsQueryOptions(scope, input),
		);
		void context.queryClient.prefetchQuery(githubViewerQueryOptions(scope));

		const cached = context.queryClient.getQueryData(runOptions.queryKey);
		return {
			runTitle: cached?.displayTitle ?? null,
		};
	},
	head: ({ match, params }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle(
				match.loaderData?.runTitle ?? `Workflow run #${params.runId}`,
			),
			description: `Workflow run #${params.runId} in ${params.owner}/${params.repo}.`,
			robots: "noindex",
		}),
	component: WorkflowRunPage,
});
