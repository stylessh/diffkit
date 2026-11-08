import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
	type GitHubQueryScope,
	githubQueryEntityCoverage,
	githubQueryMatchesEntity,
	githubQueryPath,
	githubQueryRepo,
} from "./github.query";
import {
	type GitHubChangeEntity,
	parseEntityKey,
} from "./github-change-entities";

/**
 * Change-feed client (docs/data-fetching.md, L2).
 *
 * One poll of `/api/changes` every 15 s while the tab is visible, plus one on
 * focus and on reconnect. The response lists entity keys changed since the
 * last cursor; only the active queries those entities affect refetch, and
 * inactive ones are marked stale for their next mount. An expired cursor
 * (away for 15+ minutes) refetches every active query once.
 */

export const CHANGE_FEED_INTERVAL_MS = 15_000;
/** Focus, visibility and online events within this window share one poll. */
const MIN_POLL_GAP_MS = 2_000;
const MAX_WATCHED_REPOS = 200;

export type ChangeFeedResponse = {
	cursor: string | null;
	entities: string[];
	expired: boolean;
	degraded?: boolean;
};

/**
 * Repos the client is watching, from its *active* GitHub queries. `all` is
 * true when a user-wide query (my pulls, notifications, …) is active, so the
 * server returns changes from every readable repo.
 */
export function collectWatchedRepos(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
): { repos: string[]; all: boolean } {
	const repos = new Set<string>();
	let all = false;
	for (const query of queryClient
		.getQueryCache()
		.findAll({ queryKey: ["github", scope.userId], type: "active" })) {
		const path = githubQueryPath(query.queryKey);
		const coverage = path ? githubQueryEntityCoverage[path] : undefined;
		if (!coverage || coverage === "exempt") continue;
		const repo = githubQueryRepo(query.queryKey);
		if (repo) {
			repos.add(repo);
		} else {
			all = true;
		}
	}
	return { repos: [...repos].sort().slice(0, MAX_WATCHED_REPOS), all };
}

export function buildChangeFeedUrl(
	cursor: string | null,
	watched: { repos: string[]; all: boolean },
) {
	const params = new URLSearchParams();
	if (cursor) params.set("since", cursor);
	if (watched.all) {
		params.set("scope", "all");
	} else {
		params.set("repos", watched.repos.join(","));
	}
	return `/api/changes?${params.toString()}`;
}

/**
 * Applies a feed response: one `invalidateQueries` call covering every changed
 * entity, refetching only active matches. Returns the number of entities
 * applied, or `"all"` for an expired cursor.
 */
export async function applyChangeFeedResponse(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	response: ChangeFeedResponse,
): Promise<number | "all"> {
	if (response.expired) {
		await queryClient.invalidateQueries(
			{ queryKey: ["github", scope.userId], type: "active" },
			{ cancelRefetch: false },
		);
		return "all";
	}

	const entities = response.entities
		.map(parseEntityKey)
		.filter((entity): entity is GitHubChangeEntity => entity !== null);
	if (entities.length === 0) return 0;

	await queryClient.invalidateQueries(
		{
			queryKey: ["github", scope.userId],
			refetchType: "active",
			predicate: (query) =>
				entities.some((entity) =>
					githubQueryMatchesEntity(query.queryKey, entity, query.state.data),
				),
		},
		{ cancelRefetch: false },
	);
	return entities.length;
}

export type ChangeFeedPoller = {
	poll: () => Promise<void>;
	stop: () => void;
};

export function createChangeFeedPoller(options: {
	queryClient: QueryClient;
	scope: GitHubQueryScope;
	fetchImpl?: typeof fetch;
	isVisible?: () => boolean;
	now?: () => number;
}): ChangeFeedPoller {
	const { queryClient, scope } = options;
	const fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
	const isVisible =
		options.isVisible ??
		(() =>
			typeof document === "undefined" ||
			document.visibilityState === "visible");
	const now = options.now ?? Date.now;

	let cursor: string | null = null;
	let inflight: Promise<void> | null = null;
	let lastPollAt = Number.NEGATIVE_INFINITY;
	let stopped = false;

	const run = async () => {
		const watched = collectWatchedRepos(queryClient, scope);
		if (!watched.all && watched.repos.length === 0 && cursor !== null) {
			// Nothing on screen depends on GitHub data; keep the cursor fresh
			// cheaply next time something is.
			return;
		}
		let response: Response;
		try {
			response = await fetchImpl(buildChangeFeedUrl(cursor, watched), {
				credentials: "same-origin",
				headers: { accept: "application/json" },
			});
		} catch {
			return; // Offline: focus/online will poll again.
		}
		if (response.status === 401) {
			// Session gone: the protected-route session check handles it.
			stopped = true;
			return;
		}
		if (!response.ok) return;
		let body: ChangeFeedResponse;
		try {
			body = (await response.json()) as ChangeFeedResponse;
		} catch {
			return;
		}
		if (stopped) return;
		// The first response only establishes a cursor.
		const isFirst = cursor === null;
		if (body.cursor) cursor = body.cursor;
		if (!isFirst) {
			await applyChangeFeedResponse(queryClient, scope, body);
		}
	};

	return {
		poll: () => {
			if (stopped || !isVisible()) return Promise.resolve();
			if (inflight) return inflight;
			if (now() - lastPollAt < MIN_POLL_GAP_MS) return Promise.resolve();
			lastPollAt = now();
			inflight = run().finally(() => {
				inflight = null;
			});
			return inflight;
		},
		stop: () => {
			stopped = true;
		},
	};
}

/** Mount once in the dashboard shell. */
export function useGitHubChangeFeed(userId: string) {
	const queryClient = useQueryClient();

	useEffect(() => {
		const poller = createChangeFeedPoller({
			queryClient,
			scope: { userId },
		});
		const poll = () => {
			void poller.poll();
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") poll();
		};

		poll();
		const interval = window.setInterval(poll, CHANGE_FEED_INTERVAL_MS);
		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener("focus", poll);
		window.addEventListener("online", poll);
		return () => {
			poller.stop();
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.removeEventListener("focus", poll);
			window.removeEventListener("online", poll);
		};
	}, [queryClient, userId]);
}
