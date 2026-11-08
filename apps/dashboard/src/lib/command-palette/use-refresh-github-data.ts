import { toast } from "@diffkit/ui/components/sonner";
import { useCallback } from "react";
import { GITHUB_QUERY_CACHE_STORAGE_KEY } from "#/lib/query-client";

/**
 * Drops the browser's persisted query cache and reloads, so every query
 * refetches from GitHub. There is no server-side cache to clear.
 */
export function useRefreshGitHubData() {
	return useCallback(() => {
		toast.loading("Refreshing data…");
		try {
			window.localStorage.removeItem(GITHUB_QUERY_CACHE_STORAGE_KEY);
		} catch {
			// Storage can be unavailable (private mode); the reload still refetches.
		}
		window.location.reload();
	}, []);
}
