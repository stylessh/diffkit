import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import {
	restoreGitHubQueryCache,
	restoreRestOfGitHubQueryCache,
	startGitHubQueryPersistence,
} from "#/lib/github-query-persistence";
import { createAppQueryClient } from "#/lib/query-client";

/**
 * Restore the most recently updated queries *before* hydrating, so the first
 * client render already has what the user was last looking at. Everything
 * older is restored once the browser is idle.
 *
 * While IndexedDB is read (a few milliseconds, capped at
 * GITHUB_QUERY_RESTORE_TIMEOUT_MS), the server-rendered app shell stays on
 * screen. Restoring after first render instead (PersistQueryClientProvider)
 * would let client-only route loaders fire network prefetches against an empty
 * cache and would need an `isRestoring` gate in every page.
 */
async function boot() {
	const queryClient = createAppQueryClient();
	try {
		await restoreGitHubQueryCache(queryClient);
	} catch {
		// Restore failures are cache misses.
	}
	startGitHubQueryPersistence(queryClient);

	startTransition(() => {
		hydrateRoot(
			document,
			<StrictMode>
				<StartClient />
			</StrictMode>,
		);
	});

	whenIdle(() => void restoreRestOfGitHubQueryCache(queryClient));
}

function whenIdle(task: () => void) {
	if (typeof window.requestIdleCallback === "function") {
		window.requestIdleCallback(task, { timeout: 1000 });
	} else {
		setTimeout(task, 200);
	}
}

void boot();
