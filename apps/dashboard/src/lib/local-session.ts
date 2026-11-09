import { wipeRawDiffCache } from "./diffs/raw-diff-cache";
import {
	getActiveGitHubQueryCacheUserId,
	wipeGitHubQueryCache,
} from "./github-query-persistence";
import { clearProtectedRouteCachedAuth } from "./protected-auth-cache";

/**
 * Removes everything the browser keeps about the signed-in viewer: the hint
 * cookie, in-memory auth and the user's IndexedDB query cache. In-memory
 * queries are left alone because every caller navigates away right after,
 * and clearing them first would flash skeletons.
 */
export async function clearLocalSession(userId: string | null) {
	const id = userId ?? getActiveGitHubQueryCacheUserId();
	clearProtectedRouteCachedAuth();
	try {
		await Promise.all([
			wipeGitHubQueryCache(null, id),
			id ? wipeRawDiffCache(id) : undefined,
		]);
	} catch {
		// Best effort: a failed wipe must not block signing out.
	}
}
