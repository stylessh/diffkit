import "fake-indexeddb/auto";
import { dehydrate, hydrate, QueryClient } from "@tanstack/react-query";
import { createStore, del, keys } from "idb-keyval";
import { describe, expect, it } from "vitest";
import {
	createIdbQueryPersister,
	type DehydratedQuery,
} from "./query-persister";

let dbCounter = 0;
const nextDbName = () => `test-query-cache-${++dbCounter}`;

function clientWith(
	entries: Array<{ key: unknown[]; data: unknown; updatedAt: number }>,
) {
	const queryClient = new QueryClient();
	for (const entry of entries) {
		queryClient.setQueryData(entry.key, entry.data, {
			updatedAt: entry.updatedAt,
		});
	}
	return queryClient;
}

function snapshot(queryClient: QueryClient): DehydratedQuery[] {
	return dehydrate(queryClient).queries;
}

const queryKeys = (queries: DehydratedQuery[]) =>
	queries.map((query) => query.queryKey);

async function storedQueryHashes(dbName: string) {
	const all = await keys(createStore(dbName, "queries"));
	return all
		.map(String)
		.filter((key) => !key.startsWith("__"))
		.sort();
}

const payload = (bytes: number) => ({ blob: "x".repeat(bytes) });

describe("createIdbQueryPersister", () => {
	it("round-trips successful queries and keeps their dataUpdatedAt", async () => {
		const dbName = nextDbName();
		const persister = createIdbQueryPersister({
			dbName,
			buster: "v1",
			maxBytes: 1_000_000,
			maxAgeMs: 60_000,
		});
		const updatedAt = Date.now() - 5_000;
		await persister.persist(
			snapshot(
				clientWith([
					{ key: ["github", "u1", "pulls", "mine"], data: { a: 1 }, updatedAt },
				]),
			),
		);

		const target = new QueryClient();
		hydrate(target, {
			mutations: [],
			queries: await createIdbQueryPersister({
				dbName,
				buster: "v1",
				maxBytes: 1_000_000,
				maxAgeMs: 60_000,
			}).restoreRecent(),
		});

		const state = target.getQueryState(["github", "u1", "pulls", "mine"]);
		expect(state?.data).toEqual({ a: 1 });
		expect(state?.dataUpdatedAt).toBe(updatedAt);
	});

	it("evicts least recently updated entries beyond the byte budget", async () => {
		const dbName = nextDbName();
		const persister = createIdbQueryPersister({
			dbName,
			buster: "v1",
			maxBytes: 2_500,
			maxEntryBytes: 2_000,
			maxAgeMs: 60_000,
		});
		const now = Date.now();
		const queryClient = clientWith([
			{
				key: ["github", "u1", "a"],
				data: payload(1_000),
				updatedAt: now - 3_000,
			},
			{
				key: ["github", "u1", "b"],
				data: payload(1_000),
				updatedAt: now - 2_000,
			},
			{
				key: ["github", "u1", "c"],
				data: payload(1_000),
				updatedAt: now - 1_000,
			},
		]);
		await persister.persist(snapshot(queryClient));

		const hashes = await storedQueryHashes(dbName);
		expect(hashes).toEqual(
			[
				JSON.stringify(["github", "u1", "b"]),
				JSON.stringify(["github", "u1", "c"]),
			].sort(),
		);
		expect(persister.getStoredBytes()).toBeLessThanOrEqual(2_500);

		// The evicted query is still in memory but is not re-written until its
		// data changes.
		await persister.persist(snapshot(queryClient));
		expect(await storedQueryHashes(dbName)).toHaveLength(2);

		// Fresh data for "a" makes it the newest entry; "b" is now the oldest.
		queryClient.setQueryData(["github", "u1", "a"], payload(1_000), {
			updatedAt: now,
		});
		await persister.persist(snapshot(queryClient));
		expect(await storedQueryHashes(dbName)).toEqual(
			[
				JSON.stringify(["github", "u1", "a"]),
				JSON.stringify(["github", "u1", "c"]),
			].sort(),
		);
	});

	it("keeps entries on disk after they leave memory", async () => {
		const dbName = nextDbName();
		const persister = createIdbQueryPersister({
			dbName,
			buster: "v1",
			maxBytes: 1_000_000,
			maxAgeMs: 60_000,
		});
		const now = Date.now();
		await persister.persist(
			snapshot(
				clientWith([{ key: ["github", "u1", "a"], data: 1, updatedAt: now }]),
			),
		);
		// A later save from a client where "a" was garbage-collected.
		await persister.persist(
			snapshot(
				clientWith([{ key: ["github", "u1", "b"], data: 2, updatedAt: now }]),
			),
		);
		expect(await storedQueryHashes(dbName)).toHaveLength(2);
	});

	it("never stores single entries above maxEntryBytes", async () => {
		const dbName = nextDbName();
		const persister = createIdbQueryPersister({
			dbName,
			buster: "v1",
			maxBytes: 100_000,
			maxEntryBytes: 500,
			maxAgeMs: 60_000,
		});
		await persister.persist(
			snapshot(
				clientWith([
					{ key: ["github", "u1", "big"], data: payload(1_000), updatedAt: 1 },
					{ key: ["github", "u1", "small"], data: payload(10), updatedAt: 1 },
				]),
			),
		);
		expect(await storedQueryHashes(dbName)).toEqual([
			JSON.stringify(["github", "u1", "small"]),
		]);
	});

	it("skips queries rejected by shouldPersistQuery", async () => {
		const dbName = nextDbName();
		const persister = createIdbQueryPersister({
			dbName,
			buster: "v1",
			maxBytes: 100_000,
			maxAgeMs: 60_000,
			shouldPersistQuery: (query) => query.queryKey[2] !== "secret",
		});
		await persister.persist(
			snapshot(
				clientWith([
					{ key: ["github", "u1", "secret"], data: 1, updatedAt: 1 },
					{ key: ["github", "u1", "public"], data: 2, updatedAt: 1 },
				]),
			),
		);
		expect(await storedQueryHashes(dbName)).toEqual([
			JSON.stringify(["github", "u1", "public"]),
		]);
	});

	it("wipes the database when the schema version (buster) changes", async () => {
		const dbName = nextDbName();
		const v1 = createIdbQueryPersister({
			dbName,
			buster: "v1",
			maxBytes: 100_000,
			maxAgeMs: 60_000,
		});
		await v1.persist(
			snapshot(
				clientWith([
					{ key: ["github", "u1", "a"], data: 1, updatedAt: Date.now() },
				]),
			),
		);

		const restored = await createIdbQueryPersister({
			dbName,
			buster: "v2",
			maxBytes: 100_000,
			maxAgeMs: 60_000,
		}).restoreRecent();
		expect(restored).toEqual([]);
		expect(await storedQueryHashes(dbName)).toEqual([]);
	});

	it("drops entries older than maxAgeMs on restore", async () => {
		const dbName = nextDbName();
		let now = 1_000_000;
		const options = {
			dbName,
			buster: "v1",
			maxBytes: 100_000,
			maxAgeMs: 10_000,
			now: () => now,
		};
		await createIdbQueryPersister(options).persist(
			snapshot(
				clientWith([
					{ key: ["github", "u1", "old"], data: 1, updatedAt: now - 9_000 },
					{ key: ["github", "u1", "new"], data: 2, updatedAt: now - 1_000 },
				]),
			),
		);
		now += 5_000;
		const persister = createIdbQueryPersister(options);
		expect(queryKeys(await persister.restoreRecent())).toEqual([
			["github", "u1", "new"],
		]);
		await persister.restoreRest(() => undefined);
		expect(await storedQueryHashes(dbName)).toEqual([
			JSON.stringify(["github", "u1", "new"]),
		]);
	});

	it("restores the most recently updated queries first and the rest once", async () => {
		const dbName = nextDbName();
		const options = {
			dbName,
			buster: "v1",
			maxBytes: 100_000,
			recentBytes: 2_500,
			maxAgeMs: 60_000,
		};
		const now = Date.now();
		const entry = (name: string, age: number) => ({
			key: ["github", "u1", name],
			data: payload(1_000),
			updatedAt: now - age,
		});
		await createIdbQueryPersister(options).persist(
			snapshot(
				clientWith([
					entry("oldest", 4_000),
					entry("older", 3_000),
					entry("newer", 2_000),
					entry("newest", 1_000),
				]),
			),
		);

		const persister = createIdbQueryPersister(options);
		expect(queryKeys(await persister.restoreRecent())).toEqual([
			["github", "u1", "newest"],
			["github", "u1", "newer"],
		]);

		// A save between the two restores must not hide what is still unread.
		await persister.persist(snapshot(clientWith([entry("fresh", 0)])));

		const rest: DehydratedQuery[] = [];
		await persister.restoreRest((queries) => rest.push(...queries));
		expect(queryKeys(rest).sort()).toEqual([
			["github", "u1", "older"],
			["github", "u1", "oldest"],
		]);
		expect(await storedQueryHashes(dbName)).toHaveLength(5);
	});

	it("restores everything from a database written before the recent list existed", async () => {
		const dbName = nextDbName();
		const options = {
			dbName,
			buster: "v1",
			maxBytes: 100_000,
			recentBytes: 1,
			maxAgeMs: 60_000,
		};
		await createIdbQueryPersister(options).persist(
			snapshot(
				clientWith([
					{ key: ["github", "u1", "a"], data: 1, updatedAt: Date.now() },
					{ key: ["github", "u1", "b"], data: 2, updatedAt: Date.now() },
				]),
			),
		);
		await del("__diffkit_query_cache_recent__", createStore(dbName, "queries"));

		const restored = await createIdbQueryPersister(options).restoreRecent();
		expect(queryKeys(restored).sort()).toEqual([
			["github", "u1", "a"],
			["github", "u1", "b"],
		]);
	});

	it("keeps separate databases separate", async () => {
		const a = nextDbName();
		const b = nextDbName();
		await createIdbQueryPersister({
			dbName: a,
			buster: "v1",
			maxBytes: 100_000,
			maxAgeMs: 60_000,
		}).persist(
			snapshot(
				clientWith([
					{ key: ["github", "a", "x"], data: 1, updatedAt: Date.now() },
				]),
			),
		);
		const restored = await createIdbQueryPersister({
			dbName: b,
			buster: "v1",
			maxBytes: 100_000,
			maxAgeMs: 60_000,
		}).restoreRecent();
		expect(restored).toEqual([]);
	});

	it("isolates payloads that cannot be cloned instead of failing the save", async () => {
		const dbName = nextDbName();
		const errors: string[] = [];
		const persister = createIdbQueryPersister({
			dbName,
			buster: "v1",
			maxBytes: 100_000,
			maxAgeMs: 60_000,
			onError: (_error, operation) => errors.push(operation),
		});
		await persister.persist(
			snapshot(
				clientWith([
					{ key: ["github", "u1", "fn"], data: { run: () => 1 }, updatedAt: 1 },
					{ key: ["github", "u1", "ok"], data: { ok: true }, updatedAt: 1 },
				]),
			),
		);
		expect(await storedQueryHashes(dbName)).toEqual([
			JSON.stringify(["github", "u1", "ok"]),
		]);
		expect(errors).toContain("set");
	});
});
