export const DEFAULT_AUTH_REDIRECT = "/";

const AUTH_REDIRECT_BASE_URL = "https://diffkit.local";

// Parsed rather than prefix-checked: browsers read `/\evil.com` and
// `/<TAB>/evil.com` as `//evil.com`.
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

	// "/.//evil.com" normalizes to the same-origin path "//evil.com", which a
	// browser would read as protocol-relative once it is used as a Location.
	if (
		url.origin !== AUTH_REDIRECT_BASE_URL ||
		url.pathname === "/login" ||
		url.pathname.startsWith("//")
	) {
		return fallback;
	}

	return `${url.pathname}${url.search}${url.hash}`;
}
