export type CodeLocation = { ref: string; path: string };

export type CodeLocationResolution =
	| { status: "resolved"; location: CodeLocation }
	| { status: "needsServer" };

const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;
const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;

export function isCommitSha(value: unknown): value is string {
	return typeof value === "string" && COMMIT_SHA.test(value);
}

export function isFullCommitSha(value: unknown): value is string {
	return typeof value === "string" && FULL_COMMIT_SHA.test(value);
}

export function cleanSplat(splat: string | undefined) {
	return (splat ?? "").replace(/^\/+|\/+$/g, "");
}

function splitAt(splat: string, ref: string): CodeLocation {
	return { ref, path: splat.slice(ref.length + 1) };
}

/**
 * Splits a `/tree|blob|blame/$` splat into ref and path. Branch and tag names
 * may contain slashes, so a slashed splat is only split locally when a known
 * ref (default branch, cached branch/tag names) or a commit SHA prefixes it;
 * otherwise the server resolves it (`resolveRepoRefSplat`).
 */
export function resolveCodeLocation(
	splat: string | undefined,
	refs: { defaultBranch: string; known: Iterable<string> },
): CodeLocationResolution {
	const value = cleanSplat(splat);
	if (!value) {
		return {
			status: "resolved",
			location: { ref: refs.defaultBranch, path: "" },
		};
	}
	const longestFirst = [...new Set([refs.defaultBranch, ...refs.known])]
		.filter(Boolean)
		.sort((a, b) => b.length - a.length);
	for (const ref of longestFirst) {
		if (value === ref || value.startsWith(`${ref}/`)) {
			return { status: "resolved", location: splitAt(value, ref) };
		}
	}
	const slash = value.indexOf("/");
	const first = slash === -1 ? value : value.slice(0, slash);
	if (slash === -1 || isCommitSha(first)) {
		return { status: "resolved", location: splitAt(value, first) };
	}
	return { status: "needsServer" };
}

export function codeSplat(ref: string, path: string) {
	return path ? `${ref}/${path}` : ref;
}

export type CodeView = "tree" | "blob" | "blame";

export function codeHref(
	view: CodeView,
	input: { owner: string; repo: string; ref: string; path: string },
	hash = "",
) {
	const splat = codeSplat(input.ref, input.path)
		.split("/")
		.map(encodeURIComponent)
		.join("/");
	return `/${input.owner}/${input.repo}/${view}/${splat}${hash}`;
}
