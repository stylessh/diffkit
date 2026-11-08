import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/lib/auth.server";
import { guardRoute } from "#/lib/route-safety.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

// Better Auth answers its own failures; this catches what escapes it (missing
// secret, unreachable D1).
const handleAuth = guardRoute(
	"auth",
	(request: Request) => getAuth().handler(request),
	"auth_unavailable",
);

export const Route = createFileRoute("/api/auth/$")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: ({ request }) => handleAuth(request),
			POST: ({ request }) => handleAuth(request),
		},
	},
});
