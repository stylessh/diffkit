const NETWORK_URL_PATTERN = /^(?:https?:)?\/\//iu;

/**
 * Markdown is written by anyone on GitHub, and the reader's browser fetches an
 * embedded URL as soon as it renders. A relative URL, or one for the app's own
 * origin, would be a request to the app carrying the reader's session, so only
 * URLs that name another host may load.
 */
export function loadableAssetUrl(url: string | undefined): string | undefined {
	const candidate = url?.trim();
	if (!candidate || !NETWORK_URL_PATTERN.test(candidate)) return undefined;
	if (typeof window === "undefined") return candidate;
	try {
		const { origin } = new URL(candidate, window.location.href);
		return origin === window.location.origin ? undefined : candidate;
	} catch {
		return undefined;
	}
}

export function loadableAssetSrcSet(
	srcSet: string | undefined,
	resolveAssetUrl: ((url: string) => string) | null,
): string | undefined {
	if (!srcSet) return undefined;
	const candidates = srcSet.split(",").flatMap((candidate) => {
		const match = candidate.trim().match(/^(\S+)(\s+.+)?$/u);
		if (!match) return [];
		const loadable = loadableAssetUrl(
			resolveAssetUrl ? resolveAssetUrl(match[1]) : match[1],
		);
		return loadable ? [`${loadable}${match[2] ?? ""}`] : [];
	});
	return candidates.length > 0 ? candidates.join(", ") : undefined;
}
