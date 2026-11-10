import { RequestError } from "octokit";
import { deduplicateCheckRuns, isFailedCheckRun } from "./check-runs";
import { type CheckRunItem, listCheckRunsForCommit } from "./pull-checks";
import {
	type GitHubContext,
	is403ResourceError,
	type MutationFailure,
	type PullFromRepoInput,
	toMutationError,
} from "./shared";

export type RerunChecksInput = PullFromRepoInput & {
	failedOnly: boolean;
};

export type RerunChecksResult =
	| {
			ok: true;
			rerun: number;
			/** Checks GitHub refused to rerun because they aren't eligible. */
			skipped: number;
			failed: number;
	  }
	| MutationFailure;

type RerunTask = {
	coveredCheckRuns: number;
	start: () => Promise<unknown>;
};

/**
 * GitHub Actions check URLs are usually `/actions/runs/{id}/job/{job_id}`,
 * but also plain `/actions/runs/{id}`, with a `?query`, or shortened to
 * `/runs/{id}`.
 */
function actionsWorkflowRunId(run: CheckRunItem): number | null {
	if (run.app?.slug !== "github-actions") {
		return null;
	}
	const match = run.html_url?.match(
		/\/(?:actions\/runs|runs)\/(\d+)(?:\/|$|\?)/,
	);
	return match ? Number(match[1]) : null;
}

/**
 * Actions jobs rerun through their workflow run, because
 * `checks.rerequestRun` only works for the app that owns the check. Checks
 * from other apps (GitGuardian, CodeRabbit) are still requested, and GitHub's
 * 403 for them is counted as skipped.
 */
function planReruns(
	context: GitHubContext,
	data: RerunChecksInput,
	runs: CheckRunItem[],
): RerunTask[] {
	const repository = { owner: data.owner, repo: data.repo };
	const checkRunsByWorkflowRun = new Map<number, number>();
	const tasks: RerunTask[] = [];

	for (const run of runs) {
		const workflowRunId = actionsWorkflowRunId(run);
		if (workflowRunId !== null) {
			checkRunsByWorkflowRun.set(
				workflowRunId,
				(checkRunsByWorkflowRun.get(workflowRunId) ?? 0) + 1,
			);
			continue;
		}
		tasks.push({
			coveredCheckRuns: 1,
			start: () =>
				context.octokit.rest.checks.rerequestRun({
					...repository,
					check_run_id: run.id,
				}),
		});
	}

	for (const [workflowRunId, coveredCheckRuns] of checkRunsByWorkflowRun) {
		tasks.push({
			coveredCheckRuns,
			start: () =>
				data.failedOnly
					? context.octokit.rest.actions.reRunWorkflowFailedJobs({
							...repository,
							run_id: workflowRunId,
						})
					: context.octokit.rest.actions.reRunWorkflow({
							...repository,
							run_id: workflowRunId,
						}),
		});
	}

	return tasks;
}

function isIneligibleForRerun(reason: unknown) {
	if (!(reason instanceof RequestError) || reason.status !== 403) {
		return false;
	}
	const message =
		(reason.response?.data as { message?: string } | undefined)?.message ??
		reason.message;
	return is403ResourceError(message);
}

export async function rerunPullChecks(
	context: GitHubContext,
	data: RerunChecksInput,
): Promise<RerunChecksResult> {
	try {
		const pull = await context.octokit.rest.pulls.get({
			owner: data.owner,
			repo: data.repo,
			pull_number: data.pullNumber,
		});
		const latestRuns = deduplicateCheckRuns(
			await listCheckRunsForCommit(context, {
				owner: data.owner,
				repo: data.repo,
				sha: pull.data.head.sha,
			}),
		);
		const tasks = planReruns(
			context,
			data,
			data.failedOnly ? latestRuns.filter(isFailedCheckRun) : latestRuns,
		);
		const outcomes = await Promise.allSettled(
			tasks.map((task) => task.start()),
		);

		const counts = { rerun: 0, skipped: 0, failed: 0 };
		let firstFailure: unknown;
		outcomes.forEach((outcome, index) => {
			const covered = tasks[index].coveredCheckRuns;
			if (outcome.status === "fulfilled") {
				counts.rerun += covered;
			} else if (isIneligibleForRerun(outcome.reason)) {
				counts.skipped += covered;
			} else {
				counts.failed += covered;
				firstFailure ??= outcome.reason;
			}
		});

		if (counts.rerun === 0 && counts.failed > 0) {
			return toMutationError("rerun checks", firstFailure);
		}
		return { ok: true, ...counts };
	} catch (error) {
		return toMutationError("rerun checks", error);
	}
}
