import { createServerFn } from "@tanstack/react-start";

const COOKIE_NAME = "diffkit-filters";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type SerializedPageState = {
	searchQuery: string;
	activeFilters: { fieldId: string; values: string[] }[];
	sortId: string;
};

export type SerializedFilterStore = Record<string, SerializedPageState>;

// ── Server: read cookie ────────────────────────────────────────────────

export const getFilterCookie = createServerFn({ method: "GET" }).handler(
	async (): Promise<SerializedFilterStore> => {
		const { getRequest } = await import("@tanstack/react-start/server");
		const request = getRequest();
		const cookieHeader = request.headers.get("cookie") ?? "";
		return parseCookieValue(cookieHeader);
	},
);

function parseCookieValue(cookieHeader: string): SerializedFilterStore {
	try {
		for (const cookie of cookieHeader.split(";")) {
			const [rawName, ...rawValue] = cookie.trim().split("=");
			if (rawName === COOKIE_NAME) {
				const decoded = decodeURIComponent(rawValue.join("="));
				const parsed = JSON.parse(decoded);
				if (
					typeof parsed === "object" &&
					parsed !== null &&
					!Array.isArray(parsed)
				) {
					return parsed as SerializedFilterStore;
				}
			}
		}
	} catch {
		// corrupted cookie — return empty
	}
	return {};
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

export function readFilterCookieClient(): SerializedFilterStore {
	if (typeof document === "undefined") return {};
	return parseCookieValue(document.cookie);
}
