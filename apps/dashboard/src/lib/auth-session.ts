/**
 * What `getSession()` sends to the browser: the fields the route guards and
 * the viewer hint read. Better Auth's own session object also carries the
 * session token, IP address and user agent, which no page needs.
 */
export type ClientSession = {
	user: {
		id: string;
		name: string;
		email: string;
		image: string | null;
	};
	session: {
		id: string;
		expiresAt: Date;
	};
};

type ServerSession = {
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
	};
	session: {
		id: string;
		expiresAt: Date;
	};
};

export function toClientSession(
	session: ServerSession | null,
): ClientSession | null {
	if (!session) {
		return null;
	}
	return {
		user: {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email,
			image: session.user.image ?? null,
		},
		session: {
			id: session.session.id,
			expiresAt: session.session.expiresAt,
		},
	};
}
