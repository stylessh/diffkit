import type { PullStatus, WorkflowRun, WorkflowRunJob } from "./github.types";

/**
 * Client polling — only for things that change without a webhook we receive.
 *
 * Freshness comes from the change feed (`/api/changes`, see
 * github-change-feed.ts): webhooks record which entities changed and the
 * client refetches only the active queries they affect. Lists and details no
 * longer poll on a fixed interval.
 *
 * What still polls: PR status and workflow runs/jobs, adaptively, while
 * something is queued or running (check runs from third-party CI and repos
 * without the app installed send us nothing). Everything else refetches on
 * focus, reconnect and mount once past its `staleTime`.
 */
export const githubPollIntervalMs = {
	/**
	 * A PR status poll costs ~7 REST calls; at 5 s one open PR page with
	 * running CI spent ~5,000 requests an hour, the user's whole budget.
	 */
	running: 10 * 1000,
	idle: 30 * 1000,
} as const;

export const GITHUB_SETTLED_POLL_STOP_AFTER_MS = 10 * 60 * 1000;

/**
 * - `running`: something is queued or in progress.
 * - `waiting`: nothing to classify yet (no run, no jobs, no status).
 * - `settled`: nothing left to finish (completed run, PR with no pending
 *   checks). Late results such as third-party statuses still land within the
 *   stop window; after that the change feed and focus refetch take over.
 */
export type GitHubPollPhase = "running" | "waiting" | "settled";

export function getAdaptiveRefetchInterval({
	phase,
	lastChangedAt,
	now,
}: {
	phase: GitHubPollPhase;
	lastChangedAt: number | null;
	now: number;
}): number | false {
	switch (phase) {
		case "running":
			return githubPollIntervalMs.running;
		case "waiting":
			return githubPollIntervalMs.idle;
		case "settled":
			return lastChangedAt !== null &&
				now - lastChangedAt >= GITHUB_SETTLED_POLL_STOP_AFTER_MS
				? false
				: githubPollIntervalMs.idle;
	}
}

const lastDataChangeByQuery = new WeakMap<
	object,
	{ data: unknown; changedAt: number }
>();

/**
 * Timestamp of the last time this query's data actually changed. React
 * Query's structural sharing keeps the same `data` reference when a refetch
 * returns an identical payload, so reference equality tells us "nothing
 * changed" even though `dataUpdatedAt` advances on every fetch.
 */
export function getQueryDataLastChangedAt(query: {
	state: { data: unknown; dataUpdatedAt: number };
}): number | null {
	const { data, dataUpdatedAt } = query.state;
	if (data === undefined || dataUpdatedAt === 0) {
		return null;
	}

	const tracked = lastDataChangeByQuery.get(query);
	if (!tracked) {
		lastDataChangeByQuery.set(query, { data, changedAt: dataUpdatedAt });
		return dataUpdatedAt;
	}

	if (tracked.data !== data) {
		tracked.data = data;
		tracked.changedAt = dataUpdatedAt;
	}

	return tracked.changedAt;
}

/**
 * Builds a `refetchInterval` function for data whose polling cadence depends
 * on whether something is still running.
 */
export function adaptiveRefetchInterval<TData>(
	classify: (data: TData | undefined) => GitHubPollPhase,
) {
	return (query: {
		state: { data: TData | undefined; dataUpdatedAt: number };
	}): number | false =>
		getAdaptiveRefetchInterval({
			phase: classify(query.state.data),
			lastChangedAt: getQueryDataLastChangedAt(query),
			now: Date.now(),
		});
}

export function classifyWorkflowRun(
	run: Pick<WorkflowRun, "status"> | null | undefined,
): GitHubPollPhase {
	if (!run) return "waiting";
	return run.status === "completed" ? "settled" : "running";
}

export function classifyWorkflowJobs(
	jobs: ReadonlyArray<Pick<WorkflowRunJob, "status">> | null | undefined,
): GitHubPollPhase {
	if (!jobs || jobs.length === 0) return "waiting";
	return jobs.some((job) => job.status !== "completed") ? "running" : "settled";
}

export function classifyPullStatus(
	status: Pick<PullStatus, "checks"> | null | undefined,
): GitHubPollPhase {
	if (!status) return "waiting";
	return status.checks.pending > 0 ? "running" : "settled";
}
