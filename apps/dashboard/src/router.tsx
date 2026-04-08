import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import {
	AppQueryClientProvider,
	createAppQueryClient,
} from "#/lib/query-client";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const queryClient = createAppQueryClient();
	const router = createTanStackRouter({
		routeTree,
		context: {
			queryClient,
		},
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		Wrap: ({ children }) => (
			<AppQueryClientProvider queryClient={queryClient}>
				{children}
			</AppQueryClientProvider>
		),
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
		wrapQueryClient: false,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
