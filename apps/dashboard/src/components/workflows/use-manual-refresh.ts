import { useCallback, useState } from "react";

/**
 * Tracks a refresh the user asked for, so its button can show progress while
 * background polling of the same query stays silent.
 */
export function useManualRefresh(refetch: () => Promise<unknown>) {
	const [status, setStatus] = useState<"idle" | "refreshing">("idle");

	const refresh = useCallback(() => {
		setStatus("refreshing");
		void refetch().finally(() => setStatus("idle"));
	}, [refetch]);

	return { refresh, isRefreshing: status === "refreshing" };
}
