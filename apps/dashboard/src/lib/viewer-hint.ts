import { readCookieValue, readJsonObjectCookie } from "./cookies";

/**
 * Last known signed-in viewer, stored in a non-HttpOnly cookie so both the
 * server render and the client can read it synchronously.
 *
 * It is a *hint*, not a credential. It only decides what to paint while the
 * real session check (`getSession()`) runs in the background, and which
 * per-user IndexedDB cache to restore. Every server function still
 * authenticates with the HttpOnly better-auth session cookie, so a forged
 * hint can paint a name but never fetch data. It never contains the session
 * token.
 */
export const VIEWER_HINT_COOKIE = "diffkit-viewer";

/** Upper bound for how long a hint is trusted without a successful check. */
export const VIEWER_HINT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type ViewerHint = {
	v: 1;
	id: string;
	name: string | null;
	email: string;
	image: string | null;
	sessionId: string;
	/** Epoch ms after which the hint is ignored (session expiry, capped). */
	exp: number;
};

export type SessionLike = {
	user: {
		id: string;
		name?: string | null;
		email?: string | null;
		image?: string | null;
	};
	session: {
		id: string;
		expiresAt?: Date | string | number | null;
	};
};

function safeImageUrl(value: unknown): string | null {
	if (typeof value !== "string" || value.length === 0) {
		return null;
	}
	try {
		const url = new URL(value);
		return url.protocol === "https:" ? url.toString() : null;
	} catch {
		return null;
	}
}

export function parseViewerHint(
	cookieHeader: string | null | undefined,
	now = Date.now(),
): ViewerHint | null {
	const raw = readJsonObjectCookie(cookieHeader, VIEWER_HINT_COOKIE);
	if (!raw || raw.v !== 1) {
		return null;
	}
	const { id, name, email, sessionId, exp } = raw;
	if (
		typeof id !== "string" ||
		id.length === 0 ||
		typeof email !== "string" ||
		email.length === 0 ||
		typeof sessionId !== "string" ||
		typeof exp !== "number" ||
		!Number.isFinite(exp) ||
		exp <= now
	) {
		return null;
	}
	return {
		v: 1,
		id,
		name: typeof name === "string" ? name : null,
		email,
		image: safeImageUrl(raw.image),
		sessionId,
		exp,
	};
}

export function hasViewerHintCookie(cookieHeader: string | null | undefined) {
	return readCookieValue(cookieHeader, VIEWER_HINT_COOKIE) != null;
}

export function viewerHintFromSession(
	session: SessionLike,
	now = Date.now(),
): ViewerHint | null {
	const email = session.user.email;
	if (typeof email !== "string" || email.length === 0) {
		return null;
	}
	const expiresAt =
		session.session.expiresAt == null
			? Number.NaN
			: new Date(session.session.expiresAt).getTime();
	const cap = now + VIEWER_HINT_MAX_AGE_MS;
	return {
		v: 1,
		id: session.user.id,
		name: session.user.name ?? null,
		email,
		image: safeImageUrl(session.user.image),
		sessionId: session.session.id,
		exp: Number.isFinite(expiresAt) ? Math.min(expiresAt, cap) : cap,
	};
}

export function serializeViewerHintCookie(hint: ViewerHint, now = Date.now()) {
	const maxAge = Math.max(0, Math.floor((hint.exp - now) / 1000));
	const value = encodeURIComponent(JSON.stringify(hint));
	return `${VIEWER_HINT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${
		typeof location !== "undefined" && location.protocol === "https:"
			? "; Secure"
			: ""
	}`;
}

export function writeViewerHint(hint: ViewerHint) {
	if (typeof document === "undefined") return;
	try {
		// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not available in all browsers
		document.cookie = serializeViewerHintCookie(hint);
	} catch {
		// Cookies disabled: every cold load takes the blocking session check.
	}
}

export function clearViewerHint() {
	if (typeof document === "undefined") return;
	try {
		// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not available in all browsers
		document.cookie = `${VIEWER_HINT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
	} catch {
		// ignore
	}
}
