import {
	clearViewerHint,
	type SessionLike,
	type ViewerHint,
	viewerHintFromSession,
	writeViewerHint,
} from "./viewer-hint";

/**
 * `_protected` route context. Matches what dashboard shell components (e.g.
 * the topbar) read. Deliberately excludes the session token: this object is
 * serialized into the server-rendered HTML.
 */
export type ProtectedRouteCachedAuth = {
	user: {
		id: string;
		name?: string | null;
		email: string;
		image?: string | null;
	};
	session: {
		id: string;
		userId?: string;
		expiresAt?: Date;
	};
	/**
	 * True when built from the last known viewer (the hint cookie) and not yet
	 * confirmed by `getSession()` in this page.
	 */
	optimistic: boolean;
};

let cachedAuth: ProtectedRouteCachedAuth | null = null;

/**
 * In-memory auth for client-side navigations within the dashboard. Cleared on
 * full page reloads; the hint cookie carries the viewer across those.
 */
export function getProtectedRouteCachedAuth(): ProtectedRouteCachedAuth | null {
	if (typeof window === "undefined") {
		return null;
	}
	return cachedAuth;
}

export function setProtectedRouteCachedAuth(
	next: ProtectedRouteCachedAuth,
): void {
	if (typeof window === "undefined") {
		return;
	}
	cachedAuth = next;
}

/**
 * Forget the viewer: the in-memory auth and the hint cookie. The next visit
 * to the dashboard takes the blocking session + setup check (used before
 * setup and re-authorization flows).
 */
export function clearProtectedRouteCachedAuth(): void {
	if (typeof window === "undefined") {
		return;
	}
	cachedAuth = null;
	clearViewerHint();
}

export function authFromViewerHint(hint: ViewerHint): ProtectedRouteCachedAuth {
	return {
		user: {
			id: hint.id,
			name: hint.name,
			email: hint.email,
			image: hint.image,
		},
		session: {
			id: hint.sessionId,
			userId: hint.id,
			expiresAt: new Date(hint.exp),
		},
		optimistic: true,
	};
}

export function authFromSession(
	session: SessionLike,
): ProtectedRouteCachedAuth | null {
	const email = session.user.email;
	if (typeof email !== "string" || email.length === 0) {
		return null;
	}
	const expiresAt =
		session.session.expiresAt == null
			? undefined
			: new Date(session.session.expiresAt);
	return {
		user: {
			id: session.user.id,
			name: session.user.name,
			email,
			image: session.user.image,
		},
		session: {
			id: session.session.id,
			userId: session.user.id,
			expiresAt,
		},
		optimistic: false,
	};
}

/** Remember a confirmed viewer for client navigations and the next cold load. */
export function rememberConfirmedAuth(auth: ProtectedRouteCachedAuth) {
	if (typeof window === "undefined") {
		return;
	}
	cachedAuth = { ...auth, optimistic: false };
	const hint = viewerHintFromSession({
		user: auth.user,
		session: {
			id: auth.session.id,
			expiresAt: auth.session.expiresAt ?? null,
		},
	});
	if (hint) {
		writeViewerHint(hint);
	}
}
