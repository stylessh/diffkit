export const DEFAULT_AUTH_REDIRECT = "/";

const AUTH_REDIRECT_BASE_URL = "https://diffkit.local";

/**
 * Reduces a user-supplied post-auth destination to a same-origin path.
 *
 * The value is parsed, not pattern-matched: browsers treat `/\evil.com` and
 * `/\t/evil.com` like `//evil.com`, so anything that parses to another origin
 * falls back. The result is rebuilt from the parsed URL.
 */
export function normalizeAuthRedirect(
	value: unknown,
	fallback = DEFAULT_AUTH_REDIRECT,
) {
	if (typeof value !== "string") {
		return fallback;
	}

	const redirect = value.trim();
	if (!redirect.startsWith("/") || redirect.startsWith("//")) {
		return fallback;
	}

	let url: URL;
	try {
		url = new URL(redirect, AUTH_REDIRECT_BASE_URL);
	} catch {
		return fallback;
	}

	if (url.origin !== AUTH_REDIRECT_BASE_URL || url.pathname === "/login") {
		return fallback;
	}

	return `${url.pathname}${url.search}${url.hash}`;
}
