import { parseRepoRef } from "./parse-repo-ref";

/**
 * `/commits/$` splat → `{ ref, path }`. Branch names may contain slashes, so
 * we prefer the longest known ref that prefixes the splat (same strategy as
 * the tree routes) and fall back to "first segment is the ref".
 */
export function parseCommitsSplat(
	splat: string | undefined,
	{
		refNames = [],
		defaultBranch,
	}: { refNames?: readonly string[]; defaultBranch?: string } = {},
): { ref: string | null; path: string } {
	const value = (splat ?? "").replace(/^\/+|\/+$/g, "");
	if (!value) return { ref: null, path: "" };
	const parsed = parseRepoRef(value, {
		branches: refNames.map((name) => ({ name, isProtected: false })),
		defaultBranch,
	});
	return { ref: parsed.ref, path: parsed.path };
}

export function buildCommitsSplat(ref: string, path?: string) {
	const cleanPath = path?.replace(/^\/+|\/+$/g, "");
	return cleanPath ? `${ref}/${cleanPath}` : ref;
}
