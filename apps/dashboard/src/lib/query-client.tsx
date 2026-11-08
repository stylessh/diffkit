import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: 1,
				networkMode: "online",
				// Restored and cached data renders instantly; anything past its
				// staleTime refetches in the background. Focus and reconnect catch
				// up immediately instead of waiting for the next poll tick.
				refetchOnWindowFocus: true,
				refetchOnReconnect: true,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

/**
 * One query client per request on the server, one per page in the browser.
 *
 * The browser instance is a singleton so the client entry can restore the
 * IndexedDB cache into it *before* hydration (see `src/client.tsx`), and the
 * router created during hydration picks up the warm cache.
 */
export function createAppQueryClient() {
	if (typeof window === "undefined") {
		return makeQueryClient();
	}
	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}

/** The browser query client, if one was created. Always `null` on the server. */
export function getBrowserQueryClient(): QueryClient | null {
	return browserQueryClient ?? null;
}

export function AppQueryClientProvider({
	children,
	queryClient,
}: {
	children: React.ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
