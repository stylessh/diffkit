// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { githubQueryKeys, isGitHubQueryKeyPersistable } from "./github.query";
import { githubCachePolicy } from "./github-cache-policy";
import {
	getGitHubQueryPersister,
	restoreGitHubQueryCache,
	startGitHubQueryPersistence,
	wipeGitHubQueryCache,
} from "./github-query-persistence";
import { serializeViewerHintCookie, type ViewerHint } from "./viewer-hint";

let userCounter = 0;

function signInAs(): string {
	const id = `user-${++userCounter}-${Date.now()}`;
	const hint: ViewerHint = {
		v: 1,
		id,
		name: "Test",
		email: "test@example.com",
		image: null,
		sessionId: "s",
		exp: Date.now() + 60_000,
	};
	// biome-ignore lint/suspicious/noDocumentCookie: test setup
	document.cookie = serializeViewerHintCookie(hint);
	return id;
}

async function flushSaves(queryClient: QueryClient) {
	const stop = startGitHubQueryPersistence(queryClient);
	// Any cache event schedules a save; hiding the tab flushes it immediately.
	queryClient.getQueryCache().notify({
		type: "updated",
		query: queryClient.getQueryCache().getAll()[0],
		action: { type: "invalidate" },
	} as never);
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		value: "hidden",
	});
	document.dispatchEvent(new Event("visibilitychange"));
	stop();
	// Let the persister's queued IndexedDB work finish.
	await new Promise((resolve) => setTimeout(resolve, 20));
}

afterEach(() => {
	// biome-ignore lint/suspicious/noDocumentCookie: test teardown
	document.cookie = "diffkit-viewer=; path=/; max-age=0";
});

describe("isGitHubQueryKeyPersistable", () => {
	const scope = { userId: "u" };
	const pull = { owner: "o", repo: "r", pullNumber: 1 };
	const file = { owner: "o", repo: "r", ref: "main", path: "a.ts" };

	it("persists GitHub queries by default", () => {
		expect(isGitHubQueryKeyPersistable(githubQueryKeys.pulls.mine(scope))).toBe(
			true,
		);
		expect(
			isGitHubQueryKeyPersistable(githubQueryKeys.pulls.page(scope, pull)),
		).toBe(true);
		expect(
			isGitHubQueryKeyPersistable(
				githubQueryKeys.pulls.fileSummaries(scope, pull),
			),
		).toBe(true);
	});

	it("opts out patches, file contents, logs, drafts and non-GitHub keys", () => {
		expect(
			isGitHubQueryKeyPersistable(githubQueryKeys.pulls.files(scope, pull)),
		).toBe(false);
		expect(
			isGitHubQueryKeyPersistable(
				githubQueryKeys.repo.fileContent(scope, file),
			),
		).toBe(false);
		expect(
			isGitHubQueryKeyPersistable(
				githubQueryKeys.actions.workflowRunLogsBundle(scope, {
					owner: "o",
					repo: "r",
					runId: 1,
				}),
			),
		).toBe(false);
		expect(
			isGitHubQueryKeyPersistable(githubQueryKeys.reviewDrafts.mine(scope)),
		).toBe(false);
		expect(isGitHubQueryKeyPersistable(["other", "u"])).toBe(false);
	});
});

describe("GitHub query persistence", () => {
	it("restores only persistable queries of the signed-in user", async () => {
		const userId = signInAs();
		const scope = { userId };
		const pull = { owner: "o", repo: "r", pullNumber: 1 };
		const source = new QueryClient();
		const now = Date.now();
		source.setQueryData(
			githubQueryKeys.pulls.page(scope, pull),
			{ t: "page" },
			{
				updatedAt: now,
			},
		);
		source.setQueryData(
			githubQueryKeys.pulls.files(scope, pull),
			{ t: "patch" },
			{
				updatedAt: now,
			},
		);
		source.setQueryData(
			githubQueryKeys.pulls.mine({ userId: "someone-else" }),
			{ t: "other user" },
			{ updatedAt: now },
		);
		await flushSaves(source);

		const target = new QueryClient();
		expect(await restoreGitHubQueryCache(target, { timeoutMs: 1_000 })).toBe(
			"restored",
		);
		expect(
			target.getQueryData(githubQueryKeys.pulls.page(scope, pull)),
		).toEqual({ t: "page" });
		expect(
			target.getQueryData(githubQueryKeys.pulls.files(scope, pull)),
		).toBeUndefined();
		expect(
			target.getQueryData(
				githubQueryKeys.pulls.mine({ userId: "someone-else" }),
			),
		).toBeUndefined();
	});

	it("never restores another user's database", async () => {
		const first = signInAs();
		const source = new QueryClient();
		source.setQueryData(githubQueryKeys.viewer({ userId: first }), {
			login: "a",
		});
		await flushSaves(source);

		const second = signInAs();
		const target = new QueryClient();
		await restoreGitHubQueryCache(target, { timeoutMs: 1_000 });
		expect(
			target.getQueryData(githubQueryKeys.viewer({ userId: first })),
		).toBeUndefined();
		expect(second).not.toBe(first);
	});

	it("renders restored data and refetches it in the background once stale", async () => {
		const userId = signInAs();
		const queryKey = githubQueryKeys.pulls.mine({ userId });
		const source = new QueryClient();
		source.setQueryData(
			queryKey,
			{ title: "Persisted" },
			{
				updatedAt: Date.now() - githubCachePolicy.mine.staleTimeMs - 1_000,
			},
		);
		await flushSaves(source);

		const queryClient = new QueryClient();
		await restoreGitHubQueryCache(queryClient, { timeoutMs: 1_000 });
		const queryFn = vi.fn(async () => ({ title: "Fresh" }));
		const observer = new QueryObserver(queryClient, {
			queryKey,
			queryFn,
			staleTime: githubCachePolicy.mine.staleTimeMs,
		});
		expect(observer.getCurrentResult().data).toEqual({ title: "Persisted" });
		expect(observer.getCurrentResult().isStale).toBe(true);

		const unsubscribe = observer.subscribe(() => undefined);
		await vi.waitFor(() => {
			expect(queryClient.getQueryData(queryKey)).toEqual({ title: "Fresh" });
		});
		expect(queryFn).toHaveBeenCalledTimes(1);
		unsubscribe();
	});

	it("does not refetch restored data that is still fresh", async () => {
		const userId = signInAs();
		const queryKey = githubQueryKeys.pulls.mine({ userId });
		const source = new QueryClient();
		source.setQueryData(
			queryKey,
			{ title: "Persisted" },
			{ updatedAt: Date.now() },
		);
		await flushSaves(source);

		const queryClient = new QueryClient();
		await restoreGitHubQueryCache(queryClient, { timeoutMs: 1_000 });
		const queryFn = vi.fn(async () => ({ title: "Fresh" }));
		const observer = new QueryObserver(queryClient, {
			queryKey,
			queryFn,
			staleTime: githubCachePolicy.mine.staleTimeMs,
		});
		const unsubscribe = observer.subscribe(() => undefined);
		expect(observer.getCurrentResult().data).toEqual({ title: "Persisted" });
		expect(queryFn).not.toHaveBeenCalled();
		unsubscribe();
	});

	it("wipes memory and disk on sign-out", async () => {
		const userId = signInAs();
		const queryKey = githubQueryKeys.viewer({ userId });
		const source = new QueryClient();
		source.setQueryData(queryKey, { login: "a" });
		await flushSaves(source);
		const persister = getGitHubQueryPersister(userId);
		expect(persister?.getStoredBytes()).toBeGreaterThan(0);

		await wipeGitHubQueryCache(source, userId);
		expect(source.getQueryData(queryKey)).toBeUndefined();
		expect(persister?.getStoredBytes()).toBe(0);
		// A pending save after the wipe must not write the data back.
		source.setQueryData(queryKey, { login: "a" });
		await flushSaves(source);
		expect(persister?.getStoredBytes()).toBe(0);
	});

	it("treats missing IndexedDB as a cache miss, not an error", async () => {
		signInAs();
		const original = globalThis.indexedDB;
		// @ts-expect-error simulate a browser without IndexedDB
		globalThis.indexedDB = undefined;
		try {
			await expect(
				restoreGitHubQueryCache(new QueryClient(), { timeoutMs: 100 }),
			).resolves.toBe("unavailable");
		} finally {
			globalThis.indexedDB = original;
		}
	});
});
