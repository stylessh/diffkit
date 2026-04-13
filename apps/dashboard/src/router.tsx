import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { DashboardErrorScreen } from "#/components/layouts/dashboard-error-screen";
import { NotFoundScreen } from "#/components/layouts/not-found-screen";
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
		defaultPendingMs: 0,
		defaultPendingComponent: DashboardContentLoading,
		defaultErrorComponent: DashboardErrorScreen,
		defaultNotFoundComponent: NotFoundScreen,
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
