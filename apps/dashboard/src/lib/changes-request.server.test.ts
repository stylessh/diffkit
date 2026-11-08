import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type ChangesRequestDeps,
	handleChangesRequest,
	MAX_WATCHED_REPOS,
	parseWatchedRepos,
} from "./changes-request.server";
import {
	decodeChangeCursor,
	encodeChangeCursor,
	readGitHubChanges,
	recordGitHubChanges,
} from "./github-change.server";
import { createTestD1 } from "./testing/d1-sqlite";

const NOW = Date.now();

function setup(
	options: {
		readable?: string[];
		session?: ChangesRequestDeps["getSession"];
		getReadableRepoSet?: ChangesRequestDeps["getReadableRepoSet"];
	} = {},
) {
	const { db } = createTestD1(["0006_github_change.sql"]);
	const deps: ChangesRequestDeps = {
		getSession: options.session ?? (async () => ({ user: { id: "viewer" } })),
		getReadableRepoSet:
			options.getReadableRepoSet ??
			(async () => new Set(options.readable ?? [])),
		readChanges: (readOptions) =>
			readGitHubChanges(db, { ...readOptions, now: NOW }),
	};
	const insert = (
		rows: Array<[repo: string, entityKey: string, isPrivate: boolean]>,
	) =>
		recordGitHubChanges(
			db,
			rows.map(([repo, entityKey, isPrivate]) => ({
				repo,
				entityKey,
				isPrivate,
				changedAt: NOW,
			})),
		);
	return { db, deps, insert };
}

const cursor0 = encodeChangeCursor({ id: 0, at: NOW });

function get(query: string) {
	return new Request(`https://diffkit.test/api/changes?${query}`);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("handleChangesRequest: authentication", () => {
	it("401s without a session", async () => {
		const { deps } = setup({ session: async () => null });
		const response = await handleChangesRequest(get(""), deps);
		expect(response.status).toBe(401);
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
	});

	it("503s, not 401, when the session store is down", async () => {
		// A 401 would tell the client the user signed out and stop polling.
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { deps } = setup({
			session: async () => {
				throw new Error("D1_ERROR: database is full");
			},
		});
		const response = await handleChangesRequest(get(""), deps);
		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("15");
		expect(await response.json()).toEqual({ error: "session_unavailable" });
	});
});

describe("handleChangesRequest: viewer access", () => {
	it("never returns private-repo changes the viewer cannot read", async () => {
		const { deps, insert } = setup({ readable: ["acme/api"] });
		await insert([
			["acme/api", "pull:acme/api#1", true],
			["acme/secret", "pull:acme/secret#9", true],
			["acme/secret", "notifications", true],
			["acme/secret", "repo:acme/secret", true],
			["oss/lib", "issue:oss/lib#3", false],
		]);

		const response = await handleChangesRequest(
			get(`since=${cursor0}&scope=all`),
			deps,
		);
		const body = (await response.json()) as { entities: string[] };

		expect(response.status).toBe(200);
		expect(body.entities.sort()).toEqual([
			"issue:oss/lib#3",
			"pull:acme/api#1",
		]);
	});

	it("fails closed to public repos when the readable-repo lookup fails", async () => {
		const { deps, insert } = setup({
			getReadableRepoSet: async () => new Set(),
		});
		await insert([
			["acme/api", "pull:acme/api#1", true],
			["oss/lib", "repo:oss/lib", false],
		]);
		const body = (await (
			await handleChangesRequest(get(`since=${cursor0}&scope=all`), deps)
		).json()) as { entities: string[] };
		expect(body.entities).toEqual(["repo:oss/lib"]);
	});

	it("matches repo names case-insensitively against the readable set", async () => {
		const { deps, insert } = setup({ readable: ["acme/api"] });
		await insert([["acme/api", "pull:acme/api#1", true]]);
		const body = (await (
			await handleChangesRequest(get(`since=${cursor0}&repos=ACME/API`), deps)
		).json()) as { entities: string[] };
		expect(body.entities).toEqual(["pull:acme/api#1"]);
	});

	it("limits results to the repos the client watches", async () => {
		const { deps, insert } = setup({ readable: ["acme/api", "acme/web"] });
		await insert([
			["acme/api", "pull:acme/api#1", true],
			["acme/web", "pull:acme/web#2", true],
			["acme/web", "notifications", true],
		]);
		const body = (await (
			await handleChangesRequest(get(`since=${cursor0}&repos=acme/api`), deps)
		).json()) as { entities: string[] };
		expect(body.entities.sort()).toEqual(["notifications", "pull:acme/api#1"]);
	});

	it("watches nothing when repos is missing or malformed", async () => {
		const { deps, insert } = setup({ readable: ["acme/api"] });
		await insert([["acme/api", "pull:acme/api#1", true]]);
		for (const query of ["", "repos=", "repos=not-a-repo,a/b/c,%20"]) {
			const body = (await (
				await handleChangesRequest(get(`since=${cursor0}&${query}`), deps)
			).json()) as { entities: string[] };
			expect(body.entities, query).toEqual([]);
		}
	});
});

describe("handleChangesRequest: cursors and degradation", () => {
	it("issues a cursor on the first poll and ignores a garbage cursor", async () => {
		const { deps } = setup();
		for (const query of ["", "since=garbage", "since=zzzzzzzzzzzzzzzzzzzz.1"]) {
			const body = (await (
				await handleChangesRequest(get(query), deps)
			).json()) as {
				cursor: string;
				entities: string[];
				expired: boolean;
			};
			expect(decodeChangeCursor(body.cursor)).not.toBeNull();
			expect(body).toMatchObject({ entities: [], expired: false });
		}
	});

	it("degrades to 'nothing changed' with the client's cursor when D1 fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { deps } = setup();
		deps.readChanges = async () => {
			throw new Error("D1_ERROR: too many requests");
		};
		const response = await handleChangesRequest(
			get(`since=${cursor0}&scope=all`),
			deps,
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			cursor: cursor0,
			entities: [],
			expired: false,
			degraded: true,
		});
	});

	it("degrades with a null cursor when there was none", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { deps } = setup({
			getReadableRepoSet: async () => {
				throw new Error("boom");
			},
		});
		const body = await (await handleChangesRequest(get(""), deps)).json();
		expect(body).toEqual({
			cursor: null,
			entities: [],
			expired: false,
			degraded: true,
		});
	});
});

describe("parseWatchedRepos", () => {
	it("lowercases, validates and de-duplicates", () => {
		const watched = parseWatchedRepos(
			new URL("https://x.test/?repos=Acme/Api,acme/api,bad,%20Foo/Bar%20"),
		);
		expect([...(watched ?? [])]).toEqual(["acme/api", "foo/bar"]);
	});

	it("returns null for scope=all", () => {
		expect(parseWatchedRepos(new URL("https://x.test/?scope=all"))).toBeNull();
	});

	it("caps the number of watched repos", () => {
		const repos = Array.from({ length: 500 }, (_, index) => `o/r${index}`).join(
			",",
		);
		expect(
			parseWatchedRepos(new URL(`https://x.test/?repos=${repos}`))?.size,
		).toBe(MAX_WATCHED_REPOS);
	});
});
