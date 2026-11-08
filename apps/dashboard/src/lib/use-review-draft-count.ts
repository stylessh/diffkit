import { useQuery } from "@tanstack/react-query";
import { githubReviewDraftsQueryOptions } from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";

/**
 * Pending-review count for the nav badge. Reads the cache only (`enabled:
 * false`): it never triggers the GraphQL probe, so it costs no GitHub requests
 * and is simply absent until the Drafts page has loaded in this session.
 */
export function useReviewDraftCount(userId: string): number | undefined {
	const hasMounted = useHasMounted();
	const query = useQuery({
		...githubReviewDraftsQueryOptions({ userId }),
		enabled: false,
	});
	return hasMounted ? query.data?.drafts.length : undefined;
}
