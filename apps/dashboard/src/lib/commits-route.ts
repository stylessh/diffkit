/** Deepest ref we try to resolve; refs with more slash segments fall back. */
export const MAX_REF_SEGMENTS = 10;

function cleanSplat(splat: string | undefined) {
	return (splat ?? "").replace(/^\/+|\/+$/g, "");
}

/**
 * Candidate refs for a `/commits/$` splat, shortest first: "a/b/c" →
 * ["a", "a/b", "a/b/c"]. Branch and tag names may contain slashes, so the
 * server checks which of these exist and the longest match wins.
 */
export function refPrefixCandidates(splat: string | undefined): string[] {
	const segments = cleanSplat(splat).split("/").filter(Boolean);
	const candidates: string[] = [];
	for (let i = 1; i <= Math.min(segments.length, MAX_REF_SEGMENTS); i++) {
		candidates.push(segments.slice(0, i).join("/"));
	}
	return candidates;
}

/**
 * Splits a splat into `{ ref, path }` given the longest prefix known to be a
 * ref. Without a match, the first segment is the ref (SHAs, unknown refs).
 */
export function splitCommitsSplat(
	splat: string | undefined,
	matchedRef?: string | null,
): { ref: string | null; path: string } {
	const value = cleanSplat(splat);
	if (!value) return { ref: null, path: "" };
	if (
		matchedRef &&
		(value === matchedRef || value.startsWith(`${matchedRef}/`))
	) {
		return { ref: matchedRef, path: value.slice(matchedRef.length + 1) };
	}
	const slash = value.indexOf("/");
	if (slash === -1) return { ref: value, path: "" };
	return { ref: value.slice(0, slash), path: value.slice(slash + 1) };
}

export function buildCommitsSplat(ref: string, path?: string) {
	const cleanPath = path?.replace(/^\/+|\/+$/g, "");
	return cleanPath ? `${ref}/${cleanPath}` : ref;
}

/** Encodes a ref for a URL path, keeping "/" separators (GitHub archive URLs). */
export function encodeRefPath(ref: string) {
	return ref.split("/").map(encodeURIComponent).join("/");
}
