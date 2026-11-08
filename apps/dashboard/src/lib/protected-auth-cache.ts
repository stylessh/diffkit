/** Matches dashboard shell components (e.g. topbar) route context expectations. */
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
		token?: string;
		createdAt?: Date;
		updatedAt?: Date;
	};
};

let cachedAuth: ProtectedRouteCachedAuth | null = null;

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

export function clearProtectedRouteCachedAuth(): void {
	if (typeof window === "undefined") {
		return;
	}
	cachedAuth = null;
}
