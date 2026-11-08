import type { PullStatus, WorkflowRun, WorkflowRunJob } from "./github.types";

/**
 * Client polling tiers.
 *
 * Freshness model: GitHub webhooks mark D1 revalidation signals (and bump
 * cache namespaces) so the next server read for an affected resource bypasses
 * its cached payload. The client just needs to ask again — these intervals
 * decide how often it does while the tab is visible. Every tier's
 * `githubCachePolicy.*.staleTimeMs` must stay <= its interval here so focus /
 * mount refetches and polling agree on what "stale" means.
 */
export const githubPollIntervalMs = {
	/** Repo lists, notifications, the "mine" aggregates, repo overview. */
	list: 30 * 1000,
	mine: 30 * 1000,
	/** PR / issue detail pages and their activity timelines. */
	detail: 20 * 1000,
	activity: 20 * 1000,
	/** Adaptive tiers (PR status, workflow runs/jobs) while something runs. */
	active: 5 * 1000,
	/** Adaptive tiers when nothing is queued or running. */
	idle: 30 * 1000,
} as const;

/** Adaptive tiers stop polling once terminal and unchanged for this long. */
export const GITHUB_TERMINAL_POLL_STOP_AFTER_MS = 10 * 60 * 1000;

type StaticPollTier = "list" | "mine" | "detail" | "activity";

/**
 * Spread into a query options object for fixed-interval polling. Polling is
 * paused while the tab is hidden; `refetchOnWindowFocus` catches up on return.
 */
export function githubPollOptions(tier: StaticPollTier) {
	return {
		refetchInterval: githubPollIntervalMs[tier],
		refetchIntervalInBackground: false,
	} as const;
}

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
