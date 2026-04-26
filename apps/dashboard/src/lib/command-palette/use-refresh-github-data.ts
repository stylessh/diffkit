import { toast } from "@diffkit/ui/components/sonner";
import { useCallback, useRef } from "react";
import { clearViewerGitHubCache } from "#/lib/github.functions";
import { GITHUB_QUERY_CACHE_STORAGE_KEY } from "#/lib/query-client";

export function useRefreshGitHubData() {
	const inFlightRef = useRef<Promise<void> | null>(null);

	return useCallback(() => {
		if (inFlightRef.current) {
			return inFlightRef.current;
		}

		const task = (async () => {
			const result = await clearViewerGitHubCache();
			if (!result.ok) {
				throw new Error("You need to be signed in to refresh data.");
			}
			window.localStorage.removeItem(GITHUB_QUERY_CACHE_STORAGE_KEY);
			window.location.reload();
		})();

		inFlightRef.current = task
			.catch(() => undefined)
			.finally(() => {
				inFlightRef.current = null;
			});

		toast.promise(task, {
			loading: "Refreshing data…",
			error: (error) =>
				error instanceof Error ? error.message : "Failed to refresh data",
		});

		return inFlightRef.current;
	}, []);
}
