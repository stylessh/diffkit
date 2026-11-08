import { readDocumentCookie, readJsonObjectCookie } from "#/lib/cookies";

const COOKIE_NAME = "diffkit-filters";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type SerializedPageState = {
	searchQuery: string;
	activeFilters: { fieldId: string; values: string[] }[];
	sortId: string;
};

export type SerializedFilterStore = Record<string, SerializedPageState>;

export function parseFilterCookie(
	cookieHeader: string | null | undefined,
): SerializedFilterStore {
	return (readJsonObjectCookie(cookieHeader, COOKIE_NAME) ??
		{}) as SerializedFilterStore;
}

// ── Client: write cookie ───────────────────────────────────────────────

export function writeFilterCookie(store: SerializedFilterStore) {
	try {
		const value = encodeURIComponent(JSON.stringify(store));
		// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not available in all browsers
		document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
	} catch {
		// silently ignore
	}
}

/**
 * Reads saved list filters synchronously from `document.cookie`. Loaders call
 * this instead of a server function so navigating to a list never waits on a
 * network round trip. Returns `{}` (defaults) during SSR or when the cookie is
 * missing or corrupted.
 */
export function readFilterCookieClient(): SerializedFilterStore {
	return parseFilterCookie(readDocumentCookie());
}
