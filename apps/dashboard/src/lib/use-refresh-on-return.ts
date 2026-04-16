import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { refreshInstallationAccess } from "./github.functions";
import { githubQueryKeys } from "./github.query";

/**
 * Listens for the tab becoming visible again (user returning from an external
 * site like GitHub) and refreshes the installation access cache + all GitHub
 * queries so the UI reflects any permission changes.
 *
 * Only fires once per hidden→visible transition to avoid duplicate work.
 */
export function useRefreshOnReturn({
	enabled = true,
}: {
	enabled?: boolean;
} = {}) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const wasHiddenRef = useRef(false);

	const refresh = useCallback(async () => {
		try {
			await refreshInstallationAccess();
		} finally {
			void queryClient.invalidateQueries({
				queryKey: githubQueryKeys.all,
			});
			void queryClient.invalidateQueries({
				queryKey: ["github-app-access-state"],
			});
			void router.invalidate();
		}
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
				void refresh();
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [enabled, refresh]);

	return refresh;
}
