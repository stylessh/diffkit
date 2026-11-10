import type { PullCheckRun, PullWorkflowApproval } from "../github.types";
import { deduplicateCheckRuns } from "./check-runs";
import { listPaginatedGitHubItems } from "./client";
import type { GitHubClient, GitHubContext } from "./shared";

export type CheckRunItem = Awaited<
	ReturnType<GitHubClient["rest"]["checks"]["listForRef"]>
>["data"]["check_runs"][number];
export type CombinedStatusItem = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["getCombinedStatusForRef"]>
>["data"]["statuses"][number];
export type WorkflowRunItem = Awaited<
	ReturnType<GitHubClient["rest"]["actions"]["listWorkflowRunsForRepo"]>
>["data"]["workflow_runs"][number];

type CommitTarget = { owner: string; repo: string; sha: string };

export function listCheckRunsForCommit(
	context: GitHubContext,
	{ owner, repo, sha }: CommitTarget,
) {
	return listPaginatedGitHubItems<CheckRunItem>({
		label: `check runs ${owner}/${repo}@${sha}`,
		request: (page) =>
			context.octokit.rest.checks.listForRef({
				owner,
				repo,
				ref: sha,
				page,
				per_page: 100,
			}),
		getItems: (payload) =>
			(payload as { check_runs?: CheckRunItem[] }).check_runs ?? [],
	});
}

export function listCombinedStatusesForCommit(
	context: GitHubContext,
	{ owner, repo, sha }: CommitTarget,
) {
	return listPaginatedGitHubItems<CombinedStatusItem>({
		label: `combined statuses ${owner}/${repo}@${sha}`,
		request: (page) =>
			context.octokit.rest.repos.getCombinedStatusForRef({
				owner,
				repo,
				ref: sha,
				page,
				per_page: 100,
			}),
		getItems: (payload) =>
			(payload as { statuses?: CombinedStatusItem[] }).statuses ?? [],
	});
}

export function listWorkflowRunsForCommit(
	context: GitHubContext,
	{ owner, repo, sha }: CommitTarget,
) {
	return listPaginatedGitHubItems<WorkflowRunItem>({
		label: `workflow runs ${owner}/${repo}@${sha}`,
		request: (page) =>
			context.octokit.rest.actions.listWorkflowRunsForRepo({
				owner,
				repo,
				head_sha: sha,
				page,
				per_page: 100,
			}),
		getItems: (payload) =>
			(payload as { workflow_runs?: WorkflowRunItem[] }).workflow_runs ?? [],
	});
}

function mapCheckRuns(
	checkRuns: CheckRunItem[],
	workflowRuns: WorkflowRunItem[],
	required: ReadonlySet<string>,
): PullCheckRun[] {
	const workflowRunIdByCheckSuiteId = new Map<number, number>();
	for (const run of workflowRuns) {
		if (run.check_suite_id != null) {
			workflowRunIdByCheckSuiteId.set(run.check_suite_id, run.id);
		}
	}

	return deduplicateCheckRuns(checkRuns).map((check) => {
		const suiteId = check.check_suite?.id ?? null;
		return {
			id: check.id,
			name: check.name,
			status: check.status,
			conclusion: check.conclusion,
			appAvatarUrl: check.app?.owner?.avatar_url ?? null,
			outputTitle: check.output?.title ?? null,
			startedAt: check.started_at ?? null,
			htmlUrl: check.html_url ?? null,
			required: required.has(check.name),
			workflowRunId:
				suiteId != null
					? (workflowRunIdByCheckSuiteId.get(suiteId) ?? null)
					: null,
		};
	});
}

/**
 * Commit statuses (CodeRabbit, CircleCI) are separate from check runs. The
 * combined-status endpoint returns the latest status per context within each
 * page, so the same context can repeat across page boundaries.
 */
function mapCommitStatuses(
	statuses: CombinedStatusItem[],
	checkRunNames: ReadonlySet<string>,
	required: ReadonlySet<string>,
): PullCheckRun[] {
	const latestByContext = new Map<string, CombinedStatusItem>();
	for (const status of statuses) {
		const existing = latestByContext.get(status.context);
		if (!existing || status.id > existing.id) {
			latestByContext.set(status.context, status);
		}
	}

	return Array.from(latestByContext.values())
		.filter((status) => !checkRunNames.has(status.context))
		.map((status) => {
			const isPending = status.state === "pending";
			return {
				id: status.id,
				name: status.context,
				status: isPending ? "in_progress" : "completed",
				conclusion: isPending
					? null
					: status.state === "success"
						? "success"
						: "failure",
				appAvatarUrl: status.avatar_url ?? null,
				outputTitle: status.description ?? null,
				startedAt: status.created_at ?? null,
				htmlUrl: status.target_url ?? null,
				required: required.has(status.context),
				workflowRunId: null,
			};
		});
}

function expectedChecks(
	requiredContexts: string[],
	reportedNames: ReadonlySet<string>,
): PullCheckRun[] {
	return requiredContexts
		.filter((context) => !reportedNames.has(context))
		.map((name, index) => ({
			id: -1 - index,
			name,
			status: "expected",
			conclusion: null,
			appAvatarUrl: null,
			outputTitle: null,
			startedAt: null,
			htmlUrl: null,
			required: true,
			workflowRunId: null,
		}));
}

function countChecks(checks: PullCheckRun[]) {
	const counts = {
		total: checks.length,
		passed: 0,
		failed: 0,
		pending: 0,
		skipped: 0,
		expected: 0,
	};
	for (const check of checks) {
		if (check.status === "expected") {
			counts.expected += 1;
		} else if (check.status !== "completed") {
			counts.pending += 1;
		} else if (
			check.conclusion === "success" ||
			check.conclusion === "neutral"
		) {
			counts.passed += 1;
		} else if (check.conclusion === "skipped" || check.conclusion === "stale") {
			counts.skipped += 1;
		} else if (check.conclusion !== null) {
			counts.failed += 1;
		}
	}
	return counts;
}

/**
 * GitHub marks a run as awaiting approval in three ways: `waiting` (a
 * deployment environment), `action_required` (blocked before start, e.g. on
 * re-run), and completed with conclusion `action_required` (the first-time
 * contributor gate).
 */
function pendingWorkflowApprovals(
	workflowRuns: WorkflowRunItem[],
): PullWorkflowApproval[] {
	return workflowRuns
		.filter(
			(run) =>
				run.status === "waiting" ||
				run.status === "action_required" ||
				(run.status === "completed" && run.conclusion === "action_required"),
		)
		.map((run) => ({
			workflowRunId: run.id,
			name: run.name ?? `Workflow #${run.id}`,
			event: run.event,
		}));
}

export function summarizePullChecks({
	checkRuns,
	statuses,
	workflowRuns,
	requiredContexts,
}: {
	checkRuns: CheckRunItem[];
	statuses: CombinedStatusItem[];
	workflowRuns: WorkflowRunItem[];
	requiredContexts: string[];
}) {
	const required = new Set(requiredContexts);
	const mappedCheckRuns = mapCheckRuns(checkRuns, workflowRuns, required);
	const mappedStatuses = mapCommitStatuses(
		statuses,
		new Set(mappedCheckRuns.map((run) => run.name)),
		required,
	);
	const reported = [...mappedCheckRuns, ...mappedStatuses];
	const all = [
		...reported,
		...expectedChecks(
			requiredContexts,
			new Set(reported.map((run) => run.name)),
		),
	];

	return {
		checkRuns: all,
		checks: countChecks(all),
		pendingWorkflowApprovals: pendingWorkflowApprovals(workflowRuns),
	};
}
