import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "#/lib/auth.server";

export const Route = createFileRoute("/api/auth/$")({
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
