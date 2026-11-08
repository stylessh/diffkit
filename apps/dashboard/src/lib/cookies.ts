/**
 * Returns the decoded value of cookie `name` from a `Cookie` header or
 * `document.cookie` string, or `null` when it is absent or undecodable.
 */
export function readCookieValue(
	cookieHeader: string | null | undefined,
	name: string,
): string | null {
	if (!cookieHeader) {
		return null;
	}
	for (const cookie of cookieHeader.split(";")) {
		const separator = cookie.indexOf("=");
		if (separator === -1) continue;
		if (cookie.slice(0, separator).trim() !== name) continue;
		try {
			return decodeURIComponent(cookie.slice(separator + 1).trim());
		} catch {
			return null;
		}
	}
	return null;
}

/** Parses a JSON cookie value into a plain object, or `null`. */
export function readJsonObjectCookie(
	cookieHeader: string | null | undefined,
	name: string,
): Record<string, unknown> | null {
	const raw = readCookieValue(cookieHeader, name);
	if (raw == null) {
		return null;
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		return typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

export function readDocumentCookie(): string {
	if (typeof document === "undefined") {
		return "";
	}
	try {
		return document.cookie;
	} catch {
		return "";
	}
}
