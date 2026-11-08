import { toast } from "@diffkit/ui/components/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { refreshGitHubQueryCache } from "#/lib/github-query-persistence";

/**
 * Drops the browser's persisted query cache (IndexedDB) and refetches every
 * GitHub query in place. There is no server-side cache to clear.
 */
export function useRefreshGitHubData() {
	const queryClient = useQueryClient();
	return useCallback(() => {
		const toastId = toast.loading("Refreshing data…");
		refreshGitHubQueryCache(queryClient)
			.then(() => toast.success("Data refreshed", { id: toastId }))
			.catch(() =>
				toast.error("Some data could not be refreshed", { id: toastId }),
			);
	}, [queryClient]);
}
