export const DEFAULT_AUTH_REDIRECT = "/";

const AUTH_REDIRECT_BASE_URL = "https://diffkit.local";

export function normalizeAuthRedirect(value: unknown) {
	if (typeof value !== "string") {
		return DEFAULT_AUTH_REDIRECT;
	}

	const redirect = value.trim();
	if (!redirect.startsWith("/") || redirect.startsWith("//")) {
		return DEFAULT_AUTH_REDIRECT;
	}

	let url: URL;
	try {
		url = new URL(redirect, AUTH_REDIRECT_BASE_URL);
	} catch {
		return DEFAULT_AUTH_REDIRECT;
	}

	if (url.origin !== AUTH_REDIRECT_BASE_URL || url.pathname === "/login") {
		return DEFAULT_AUTH_REDIRECT;
	}

	return `${url.pathname}${url.search}${url.hash}`;
}
