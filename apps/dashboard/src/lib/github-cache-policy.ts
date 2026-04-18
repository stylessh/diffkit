export const githubCachePolicy = {
	viewer: {
		staleTimeMs: 30 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	reposList: {
		staleTimeMs: 10 * 60 * 1000,
		gcTimeMs: 12 * 60 * 60 * 1000,
	},
	list: {
		staleTimeMs: 2 * 60 * 1000,
		gcTimeMs: 60 * 60 * 1000,
	},
	/** User-scoped "My pulls/issues/reviews" aggregates — shorter TTL + faster webhook alignment */
	mine: {
		staleTimeMs: 30 * 1000,
		gcTimeMs: 15 * 60 * 1000,
	},
	detail: {
		staleTimeMs: 30 * 1000,
		gcTimeMs: 10 * 60 * 1000,
	},
	activity: {
		staleTimeMs: 20 * 1000,
		gcTimeMs: 10 * 60 * 1000,
	},
	userActivity: {
		staleTimeMs: 5 * 60 * 1000,
		gcTimeMs: 30 * 60 * 1000,
	},
	status: {
		staleTimeMs: 15 * 1000,
		gcTimeMs: 5 * 60 * 1000,
	},
	contributions: {
		staleTimeMs: 60 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	repoMeta: {
		staleTimeMs: 30 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
	installationAccess: {
		staleTimeMs: 30 * 60 * 1000,
		gcTimeMs: 24 * 60 * 60 * 1000,
	},
} as const;
