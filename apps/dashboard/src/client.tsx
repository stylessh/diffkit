import { StartClient } from "@tanstack/react-start/client";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import {
	restoreGitHubQueryCache,
	startGitHubQueryPersistence,
} from "#/lib/github-query-persistence";
import { createAppQueryClient } from "#/lib/query-client";

/**
 * Restore the persisted query cache *before* hydrating, so the first client
 * render already has every query the user has seen before.
 *
 * While IndexedDB is read (typically 10–50 ms, capped at
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
}

void boot();
