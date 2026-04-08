const completedRoutePreloads = new Set<string>();
const inFlightRoutePreloads = new Map<string, Promise<unknown>>();

export function preloadRouteOnce(
	router: {
		preloadRoute: (options: { to: string }) => Promise<unknown>;
	},
	to: string,
) {
	if (completedRoutePreloads.has(to)) {
		return Promise.resolve();
	}

	const existingTask = inFlightRoutePreloads.get(to);
	if (existingTask) {
		return existingTask;
	}

	const task = router
		.preloadRoute({ to })
		.then((result) => {
			completedRoutePreloads.add(to);
			return result;
		})
		.finally(() => {
			inFlightRoutePreloads.delete(to);
		});

	inFlightRoutePreloads.set(to, task);

	return task;
}
