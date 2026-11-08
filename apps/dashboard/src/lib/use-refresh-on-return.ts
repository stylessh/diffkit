import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { githubQueryKeys } from "./github.query";

/**
 * Refetches GitHub data once per hidden → visible transition: the user is
 * coming back from changing app permissions on github.com.
 */
export function useRefreshOnReturn({
	enabled = true,
}: {
	enabled?: boolean;
} = {}) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const wasHiddenRef = useRef(false);

	const refresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: githubQueryKeys.all });
		void queryClient.invalidateQueries({
			queryKey: ["github-app-access-state"],
		});
		void router.invalidate();
	}, [queryClient, router]);

	useEffect(() => {
		if (!enabled) return;

		function handleVisibilityChange() {
			if (document.hidden) {
				wasHiddenRef.current = true;
				return;
			}

			if (wasHiddenRef.current) {
				wasHiddenRef.current = false;
				refresh();
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [enabled, refresh]);

	return refresh;
}
