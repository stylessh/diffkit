import { readCookieValue } from "#/lib/cookies";

export type SidebarLayout = "expanded" | "collapsed";

const COOKIE_NAME = "diffkit-sidebar";
const MAX_AGE = 60 * 60 * 24 * 365;

export function parseSidebarLayout(
	cookieHeader: string | null | undefined,
): SidebarLayout {
	return readCookieValue(cookieHeader, COOKIE_NAME) === "collapsed"
		? "collapsed"
		: "expanded";
}

export function writeSidebarLayout(layout: SidebarLayout) {
	try {
		// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not available in all browsers
		document.cookie = `${COOKIE_NAME}=${layout}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
	} catch {}
}
