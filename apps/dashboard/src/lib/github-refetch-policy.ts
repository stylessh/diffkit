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
	/** Adaptive tiers (PR status, workflow runs/jobs) while something runs. */
	active: 5 * 1000,
	/** Adaptive tiers when nothing is queued or running. */
	idle: 30 * 1000,
} as const;

/** Adaptive tiers stop polling once terminal and unchanged for this long. */
export const GITHUB_TERMINAL_POLL_STOP_AFTER_MS = 10 * 60 * 1000;

export type GitHubAdaptivePollState = {
	/** Something is queued or in progress — poll fast. */
	isActive: boolean;
	/** The entity can no longer change on its own (completed run, closed PR). */
	isTerminal: boolean;
};

export function getAdaptiveRefetchInterval({
	isActive,
	isTerminal,
	lastChangedAt,
	now,
}: GitHubAdaptivePollState & {
	lastChangedAt: number | null;
	now: number;
}): number | false {
	if (isActive) {
		return githubPollIntervalMs.active;
	}

	if (
		isTerminal &&
		lastChangedAt !== null &&
		now - lastChangedAt >= GITHUB_TERMINAL_POLL_STOP_AFTER_MS
	) {
		return false;
	}

	return githubPollIntervalMs.idle;
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
	classify: (data: TData | undefined) => GitHubAdaptivePollState,
) {
	return (query: {
		state: { data: TData | undefined; dataUpdatedAt: number };
	}): number | false =>
		getAdaptiveRefetchInterval({
			...classify(query.state.data),
			lastChangedAt: getQueryDataLastChangedAt(query),
			now: Date.now(),
		});
}

export function classifyWorkflowRun(
	run: Pick<WorkflowRun, "status"> | null | undefined,
): GitHubAdaptivePollState {
	if (!run) {
		return { isActive: false, isTerminal: false };
	}

	const isTerminal = run.status === "completed";
	return { isActive: !isTerminal, isTerminal };
}

export function classifyWorkflowJobs(
	jobs: ReadonlyArray<Pick<WorkflowRunJob, "status">> | null | undefined,
): GitHubAdaptivePollState {
	if (!jobs || jobs.length === 0) {
		return { isActive: false, isTerminal: false };
	}

	const isActive = jobs.some((job) => job.status !== "completed");
	return { isActive, isTerminal: !isActive };
}

export function classifyPullStatus(
	status: Pick<PullStatus, "checks"> | null | undefined,
	{ isPullClosed = false }: { isPullClosed?: boolean } = {},
): GitHubAdaptivePollState {
	const hasRunningChecks = (status?.checks.pending ?? 0) > 0;
	return {
		isActive: hasRunningChecks,
		isTerminal: isPullClosed && !hasRunningChecks,
	};
}
