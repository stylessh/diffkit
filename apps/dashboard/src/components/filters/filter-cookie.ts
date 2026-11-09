import { readDocumentCookie, readJsonObjectCookie } from "#/lib/cookies";

const COOKIE_NAME = "diffkit-filters";
const MAX_AGE = 60 * 60 * 24 * 365;

/** The last filters and sort of one list, in their URL form. */
export type RememberedView = { filters?: string; sort?: string };

export type RememberedViews = Record<string, RememberedView>;

function asRememberedView(value: unknown): RememberedView | null {
	if (typeof value !== "object" || value === null) return null;
	const { filters, sort } = value as Record<string, unknown>;
	const view: RememberedView = {};
	if (typeof filters === "string" && filters) view.filters = filters;
	if (typeof sort === "string" && sort) view.sort = sort;
	return view.filters || view.sort ? view : null;
}

export function parseRememberedViews(
	cookieHeader: string | null | undefined,
): RememberedViews {
	const raw = readJsonObjectCookie(cookieHeader, COOKIE_NAME) ?? {};
	const views: RememberedViews = {};
	for (const [listId, value] of Object.entries(raw)) {
		const view = asRememberedView(value);
		if (view) views[listId] = view;
	}
	return views;
}

export function readRememberedView(listId: string): RememberedView | null {
	return parseRememberedViews(readDocumentCookie())[listId] ?? null;
}

export function rememberView(listId: string, view: RememberedView) {
	const views = parseRememberedViews(readDocumentCookie());
	const next = asRememberedView(view);
	if (next) views[listId] = next;
	else delete views[listId];
	try {
		const value = encodeURIComponent(JSON.stringify(views));
		// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not available in all browsers
		document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
	} catch {}
}
