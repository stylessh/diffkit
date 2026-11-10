/**
 * How long data nobody is looking at stays in memory. A reload repaints from
 * IndexedDB (kept 7 days), so a shorter window here only meant that staying
 * in the tab was worse than reloading it: coming back to a pull request
 * after ten minutes showed a skeleton for data we still had on disk.
 */
const SEEN_DATA_GC_TIME_MS = 24 * 60 * 60 * 1000;

export const githubCachePolicy = {
	viewer: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	reposList: {
		staleTimeMs: 2 * 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	list: {
		staleTimeMs: 30 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	/** User-scoped "My pulls/issues/reviews" aggregates */
	mine: {
		staleTimeMs: 10 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	detail: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	/** Patches, diffs and file contents: large, and not persisted to disk. */
	blob: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: 10 * 60 * 1000,
	},
	activity: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	userActivity: {
		staleTimeMs: 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	status: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	workflowRun: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	contributions: {
		staleTimeMs: 15 * 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	repoMeta: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	repoParticipation: {
		staleTimeMs: 15 * 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	installationAccess: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	repoProtection: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	itemReference: {
		staleTimeMs: 60 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	commitReference: {
		staleTimeMs: Number.POSITIVE_INFINITY,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
	settings: {
		staleTimeMs: 30 * 1000,
		gcTimeMs: SEEN_DATA_GC_TIME_MS,
	},
} as const;

export type GitHubCacheTier = keyof typeof githubCachePolicy;

export function githubCacheTimes(tier: GitHubCacheTier) {
	const { staleTimeMs, gcTimeMs } = githubCachePolicy[tier];
	return { staleTime: staleTimeMs, gcTime: gcTimeMs };
}
