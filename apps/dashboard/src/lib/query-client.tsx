import {
	dehydrate,
	hydrate,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { githubCachePolicy } from "./github-cache-policy";

const GITHUB_QUERY_CACHE_STORAGE_KEY = "quickhub:github-query-cache:v1";
const GITHUB_QUERY_CACHE_MAX_AGE_MS = githubCachePolicy.viewer.gcTimeMs;

type PersistedGitHubQueryCache = {
	version: 1;
	persistedAt: number;
	clientState: unknown;
};

function shouldPersistGitHubQuery(query: {
	state: { status: string };
	meta?: Record<string, unknown>;
	queryKey: readonly unknown[];
}) {
	return (
		query.state.status === "success" &&
		query.meta?.persist === true &&
		query.queryKey[0] === "github"
	);
}

function restorePersistedGitHubQueryCache(queryClient: QueryClient) {
	if (typeof window === "undefined") {
		return;
	}

	const rawState = window.localStorage.getItem(GITHUB_QUERY_CACHE_STORAGE_KEY);
	if (!rawState) {
		return;
	}

	try {
		const persistedState = JSON.parse(rawState) as PersistedGitHubQueryCache;
		const isExpired =
			Date.now() - persistedState.persistedAt > GITHUB_QUERY_CACHE_MAX_AGE_MS;

		if (persistedState.version !== 1 || isExpired) {
			window.localStorage.removeItem(GITHUB_QUERY_CACHE_STORAGE_KEY);
			return;
		}

		hydrate(queryClient, persistedState.clientState);
	} catch {
		window.localStorage.removeItem(GITHUB_QUERY_CACHE_STORAGE_KEY);
	}
}

function persistGitHubQueryCache(queryClient: QueryClient) {
	if (typeof window === "undefined") {
		return () => undefined;
	}

	let timeoutId: number | undefined;

	const writeCache = () => {
		const clientState = dehydrate(queryClient, {
			shouldDehydrateQuery: shouldPersistGitHubQuery,
		});

		if (clientState.queries.length === 0) {
			window.localStorage.removeItem(GITHUB_QUERY_CACHE_STORAGE_KEY);
			return;
		}

		const payload: PersistedGitHubQueryCache = {
			version: 1,
			persistedAt: Date.now(),
			clientState,
		};

		window.localStorage.setItem(
			GITHUB_QUERY_CACHE_STORAGE_KEY,
			JSON.stringify(payload),
		);
	};

	const scheduleWrite = () => {
		if (typeof timeoutId !== "undefined") {
			window.clearTimeout(timeoutId);
		}

		timeoutId = window.setTimeout(writeCache, 250);
	};

	const unsubscribe = queryClient.getQueryCache().subscribe(() => {
		scheduleWrite();
	});

	const flushOnUnload = () => {
		if (typeof timeoutId !== "undefined") {
			window.clearTimeout(timeoutId);
			timeoutId = undefined;
		}
		writeCache();
	};

	window.addEventListener("beforeunload", flushOnUnload);

	return () => {
		unsubscribe();
		window.removeEventListener("beforeunload", flushOnUnload);
		if (typeof timeoutId !== "undefined") {
			window.clearTimeout(timeoutId);
		}
	};
}

function GitHubQueryPersistence({ queryClient }: { queryClient: QueryClient }) {
	useEffect(() => {
		return persistGitHubQueryCache(queryClient);
	}, [queryClient]);

	return null;
}

export function createAppQueryClient() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				refetchOnWindowFocus: false,
				retry: 1,
				networkMode: "online",
			},
		},
	});

	restorePersistedGitHubQueryCache(queryClient);

	return queryClient;
}

export function AppQueryClientProvider({
	children,
	queryClient,
}: {
	children: React.ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<QueryClientProvider client={queryClient}>
			<GitHubQueryPersistence queryClient={queryClient} />
			{children}
		</QueryClientProvider>
	);
}
