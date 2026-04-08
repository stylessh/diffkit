import {
	dehydrate,
	hydrate,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { githubCachePolicy } from "./github-cache-policy";
import { readStoredTabs, type Tab, useTabs } from "./tab-store";

const GITHUB_QUERY_CACHE_STORAGE_KEY = "quickhub:github-query-cache:v1";
const GITHUB_QUERY_CACHE_MAX_AGE_MS = githubCachePolicy.viewer.gcTimeMs;

type PersistedGitHubQueryCache = {
	version: 1;
	persistedAt: number;
	clientState: unknown;
};

type PersistBehavior = true | "tab";

type PersistableGitHubQuery = {
	state: { status: string };
	meta?: Record<string, unknown>;
	queryKey: readonly unknown[];
};

function isPullQueryKeyInput(
	value: unknown,
): value is { owner: string; repo: string; pullNumber: number } {
	return Boolean(
		value &&
			typeof value === "object" &&
			typeof (value as { owner?: unknown }).owner === "string" &&
			typeof (value as { repo?: unknown }).repo === "string" &&
			typeof (value as { pullNumber?: unknown }).pullNumber === "number",
	);
}

function isIssueQueryKeyInput(
	value: unknown,
): value is { owner: string; repo: string; issueNumber: number } {
	return Boolean(
		value &&
			typeof value === "object" &&
			typeof (value as { owner?: unknown }).owner === "string" &&
			typeof (value as { repo?: unknown }).repo === "string" &&
			typeof (value as { issueNumber?: unknown }).issueNumber === "number",
	);
}

function matchesTabQuery(queryKey: readonly unknown[], tab: Tab) {
	const resourceType = queryKey[2];
	const resourceName = queryKey[3];
	const input = queryKey[4];
	const [owner, repo] = tab.repo.split("/");

	if (tab.type === "pull") {
		return (
			resourceType === "pulls" &&
			(resourceName === "page" ||
				resourceName === "detail" ||
				resourceName === "comments" ||
				resourceName === "status") &&
			isPullQueryKeyInput(input) &&
			input.owner === owner &&
			input.repo === repo &&
			input.pullNumber === tab.number
		);
	}

	return (
		resourceType === "issues" &&
		(resourceName === "page" ||
			resourceName === "detail" ||
			resourceName === "comments") &&
		isIssueQueryKeyInput(input) &&
		input.owner === owner &&
		input.repo === repo &&
		input.issueNumber === tab.number
	);
}

function shouldPersistGitHubQuery(query: PersistableGitHubQuery) {
	const persist = query.meta?.persist as PersistBehavior | undefined;

	if (query.state.status !== "success" || query.queryKey[0] !== "github") {
		return false;
	}

	if (persist === true) {
		return true;
	}

	if (persist === "tab") {
		return readStoredTabs().some((tab) => matchesTabQuery(query.queryKey, tab));
	}

	return false;
}

function pruneClosedTabQueries(queryClient: QueryClient, tabs: Tab[]) {
	queryClient.removeQueries({
		predicate: (query) =>
			query.queryKey[0] === "github" &&
			query.meta?.persist === "tab" &&
			!tabs.some((tab) => matchesTabQuery(query.queryKey, tab)),
	});
}

function usePruneClosedTabQueries(queryClient: QueryClient) {
	const tabs = useTabs();
	const tabsRef = useRef(tabs);

	useEffect(() => {
		if (tabsRef.current === tabs) {
			return;
		}

		tabsRef.current = tabs;
		pruneClosedTabQueries(queryClient, tabs);
	}, [queryClient, tabs]);
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
		pruneClosedTabQueries(queryClient, readStoredTabs());
		return persistGitHubQueryCache(queryClient);
	}, [queryClient]);
	usePruneClosedTabQueries(queryClient);

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
