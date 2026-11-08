export const githubCachePolicy = {
	viewer: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	reposList: {
		staleTimeMs: 2 * 60 * 1000,
		gcTimeMs: 12 * 60 * 60 * 1000,
	},
	list: {
		staleTimeMs: 30 * 1000,
		gcTimeMs: 60 * 60 * 1000,
	},
	/** User-scoped "My pulls/issues/reviews" aggregates */
	mine: {
		staleTimeMs: 10 * 1000,
		gcTimeMs: 15 * 60 * 1000,
	},
	detail: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: 10 * 60 * 1000,
	},
	activity: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: 10 * 60 * 1000,
	},
	userActivity: {
		staleTimeMs: 60 * 1000,
		gcTimeMs: 30 * 60 * 1000,
	},
	status: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: 5 * 60 * 1000,
	},
	workflowRun: {
		staleTimeMs: 5 * 1000,
		gcTimeMs: 5 * 60 * 1000,
	},
	contributions: {
		staleTimeMs: 15 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	repoMeta: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	repoParticipation: {
		staleTimeMs: 15 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	installationAccess: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	repoProtection: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	itemReference: {
		staleTimeMs: 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	commitReference: {
		staleTimeMs: Number.POSITIVE_INFINITY,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	settings: {
		staleTimeMs: 30 * 1000,
		gcTimeMs: 60 * 60 * 1000,
	},
} as const;
