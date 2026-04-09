import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/lib/auth.server";
import { PRIVATE_ROUTE_HEADERS } from "#/lib/seo";

export const Route = createFileRoute("/api/auth/$")({
	headers: () => PRIVATE_ROUTE_HEADERS,
	server: {
		handlers: {
			GET: async ({ request }) => {
				const auth = getAuth();
				return auth.handler(request);
			},
			POST: async ({ request }) => {
				const auth = getAuth();
				return auth.handler(request);
			},
		},
	},
});
