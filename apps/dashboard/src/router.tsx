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

/** Minimum time a pending component stays up once shown, so it never flashes. */
const PENDING_MIN_MS = 200;

export function getRouter() {
	const queryClient = createAppQueryClient();
	const isBrowser = typeof window !== "undefined";
	const router = createTanStackRouter({
		routeTree,
		context: {
			queryClient,
		},
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		// Loaders never await data, so a route only pends on genuinely slow,
		// uncached work. Wait 300 ms before showing a pending component, and
		// keep it for at least 200 ms once shown so it never flashes.
		//
		// Exception: during hydration the router force-holds every match whose
		// pending component was server-rendered (all `ssr: false` routes) for
		// pendingMinMs, even when its data is already in the restored cache.
		// The server-rendered spinner is invisible for its first 300 ms
		// (`.pending-reveal`), so there is no flash to guard against; use 0 for
		// the first load and switch to PENDING_MIN_MS once it resolves.
		defaultPendingMs: 300,
		defaultPendingMinMs: isBrowser ? 0 : PENDING_MIN_MS,
		defaultPendingComponent: DashboardContentLoading,
		defaultErrorComponent: DashboardErrorScreen,
		defaultNotFoundComponent: NotFoundScreen,
		Wrap: ({ children }) => (
			<AppQueryClientProvider queryClient={queryClient}>
				{children}
			</AppQueryClientProvider>
		),
	});

	if (isBrowser) {
		const unsubscribe = router.subscribe("onResolved", () => {
			router.options.defaultPendingMinMs = PENDING_MIN_MS;
			unsubscribe();
		});
	}

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
