import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/lib/auth.server";
import { guardRoute } from "#/lib/route-safety.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

// Better Auth turns its own failures into responses; this only catches what
// escapes it (a missing secret, an unreachable D1) so sign-in shows a clear
// 503 instead of a Workers 1101 page.
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
