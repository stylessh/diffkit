import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { githubQueryKeys } from "./github.query";
import {
	applyChangeFeedResponse,
	buildChangeFeedUrl,
	collectWatchedRepos,
	createChangeFeedPoller,
} from "./github-change-feed";

const scope = { userId: "u1" };
const pull12 = githubQueryKeys.pulls.page(scope, {
	owner: "acme",
	repo: "api",
	pullNumber: 12,
});
const pull13 = githubQueryKeys.pulls.page(scope, {
	owner: "acme",
	repo: "api",
	pullNumber: 13,
});
const labels = githubQueryKeys.repoLabels(scope, {
	owner: "acme",
	repo: "web",
});

function observe(queryClient: QueryClient, queryKey: readonly unknown[]) {
	const queryFn = vi.fn(async () => ({ fresh: true }));
	const observer = new QueryObserver(queryClient, {
		queryKey,
		queryFn,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const unsubscribe = observer.subscribe(() => undefined);
	return { queryFn, unsubscribe };
}

function seeded() {
	const queryClient = new QueryClient();
	for (const key of [pull12, pull13, labels]) {
		queryClient.setQueryData(key, { cached: true });
	}
	return queryClient;
}

const clients: QueryClient[] = [];
afterEach(() => {
	for (const client of clients.splice(0)) client.clear();
});

describe("collectWatchedRepos", () => {
	it("lists repos of active queries and flags user-wide ones", () => {
		const queryClient = seeded();
		clients.push(queryClient);
		const a = observe(queryClient, pull12);
		expect(collectWatchedRepos(queryClient, scope)).toEqual({
			repos: ["acme/api"],
			all: false,
		});
		queryClient.setQueryData(githubQueryKeys.pulls.mine(scope), {});
		const b = observe(queryClient, githubQueryKeys.pulls.mine(scope));
		expect(collectWatchedRepos(queryClient, scope).all).toBe(true);
		a.unsubscribe();
		b.unsubscribe();
	});

	it("ignores inactive and exempt queries", () => {
		const queryClient = seeded();
		clients.push(queryClient);
		queryClient.setQueryData(githubQueryKeys.viewer(scope), {});
		const viewer = observe(queryClient, githubQueryKeys.viewer(scope));
		expect(collectWatchedRepos(queryClient, scope)).toEqual({
			repos: [],
			all: false,
		});
		viewer.unsubscribe();
	});

	it("builds the request URL", () => {
		expect(
			buildChangeFeedUrl("c1", { repos: ["a/b", "c/d"], all: false }),
		).toBe("/api/changes?since=c1&repos=a%2Fb%2Cc%2Fd");
		expect(buildChangeFeedUrl(null, { repos: [], all: true })).toBe(
			"/api/changes?scope=all",
		);
	});
});

describe("applyChangeFeedResponse", () => {
	it("refetches only active queries the entities affect", async () => {
		const queryClient = seeded();
		clients.push(queryClient);
		const active12 = observe(queryClient, pull12);
		const active13 = observe(queryClient, pull13);

		await applyChangeFeedResponse(queryClient, scope, {
			cursor: "c",
			entities: ["pull:acme/api#12", "garbage"],
			expired: false,
		});

		expect(active12.queryFn).toHaveBeenCalledTimes(1);
		expect(active13.queryFn).not.toHaveBeenCalled();
		// Inactive affected queries are only marked stale.
		expect(queryClient.getQueryState(labels)?.isInvalidated).toBe(false);
		active12.unsubscribe();
		active13.unsubscribe();
	});

	it("marks inactive affected queries stale without fetching", async () => {
		const queryClient = seeded();
		clients.push(queryClient);
		await applyChangeFeedResponse(queryClient, scope, {
			cursor: "c",
			entities: ["labels:acme/web"],
			expired: false,
		});
		expect(queryClient.getQueryState(labels)?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(labels)?.fetchStatus).toBe("idle");
	});

	it("refetches every active query when the cursor expired", async () => {
		const queryClient = seeded();
		clients.push(queryClient);
		const active12 = observe(queryClient, pull12);
		const active13 = observe(queryClient, pull13);
		expect(
			await applyChangeFeedResponse(queryClient, scope, {
				cursor: "c",
				entities: [],
				expired: true,
			}),
		).toBe("all");
		expect(active12.queryFn).toHaveBeenCalledTimes(1);
		expect(active13.queryFn).toHaveBeenCalledTimes(1);
		expect(queryClient.getQueryState(labels)?.isInvalidated).toBe(false);
		active12.unsubscribe();
		active13.unsubscribe();
	});
});

describe("createChangeFeedPoller", () => {
	function respond(body: unknown, status = 200) {
		return new Response(JSON.stringify(body), { status });
	}

	it("uses the first response as a cursor and applies later ones", async () => {
		const queryClient = seeded();
		clients.push(queryClient);
		const active12 = observe(queryClient, pull12);
		let time = 0;
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(
				respond({
					cursor: "c1",
					entities: ["pull:acme/api#12"],
					expired: false,
				}),
			)
			.mockResolvedValueOnce(
				respond({
					cursor: "c2",
					entities: ["pull:acme/api#12"],
					expired: false,
				}),
			);
		const poller = createChangeFeedPoller({
			queryClient,
			scope,
			fetchImpl,
			isVisible: () => true,
			now: () => time,
		});

		await poller.poll();
		expect(active12.queryFn).not.toHaveBeenCalled();
		time += 15_000;
		await poller.poll();
		expect(fetchImpl.mock.calls[1][0]).toContain("since=c1");
		expect(active12.queryFn).toHaveBeenCalledTimes(1);
		active12.unsubscribe();
	});

	it("skips hidden tabs, coalesces bursts and stops on 401", async () => {
		const queryClient = seeded();
		clients.push(queryClient);
		const active12 = observe(queryClient, pull12);
		let visible = false;
		const fetchImpl = vi.fn().mockResolvedValue(respond({}, 401));
		const poller = createChangeFeedPoller({
			queryClient,
			scope,
			fetchImpl,
			isVisible: () => visible,
			now: () => 0,
		});
		await poller.poll();
		expect(fetchImpl).not.toHaveBeenCalled();

		visible = true;
		await Promise.all([poller.poll(), poller.poll()]);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		await poller.poll();
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		active12.unsubscribe();
	});

	it("treats network errors as a skipped poll", async () => {
		const queryClient = seeded();
		clients.push(queryClient);
		const active12 = observe(queryClient, pull12);
		const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline"));
		const poller = createChangeFeedPoller({
			queryClient,
			scope,
			fetchImpl,
			isVisible: () => true,
		});
		await expect(poller.poll()).resolves.toBeUndefined();
		active12.unsubscribe();
	});
});
