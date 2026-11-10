import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type ChangesRequestDeps,
	handleChangesRequest,
} from "./changes-request.server";
import {
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
	const { db } = createTestD1([
		"0006_github_change.sql",
		"0008_github_change_latest.sql",
	]);
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

const cursor0 = encodeChangeCursor({ version: 0, at: NOW });

function get(query: string) {
	return new Request(`https://diffkit.test/api/changes?${query}`);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("handleChangesRequest", () => {
	it("401s without a session", async () => {
		const { deps } = setup({ session: async () => null });
		const response = await handleChangesRequest(get(""), deps);
		expect(response.status).toBe(401);
	});

	it("503s, not 401, when the session store is down", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { deps } = setup({
			session: async () => {
				throw new Error("D1_ERROR: database is full");
			},
		});
		const response = await handleChangesRequest(get(""), deps);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: "session_unavailable" });
	});

	it("never returns private-repo changes the viewer cannot read", async () => {
		const { deps, insert } = setup({ readable: ["acme/api"] });
		await insert([
			["acme/api", "pull:acme/api#1", true],
			["acme/secret", "pull:acme/secret#9", true],
			["acme/secret", "notifications", true],
			["oss/lib", "issue:oss/lib#3", false],
		]);

		const body = (await (
			await handleChangesRequest(get(`since=${cursor0}&scope=all`), deps)
		).json()) as { entities: string[] };

		expect(body.entities.sort()).toEqual([
			"issue:oss/lib#3",
			"pull:acme/api#1",
		]);
	});

	it("serves only public repos when the readable-repo lookup came back empty", async () => {
		const { deps, insert } = setup({ readable: [] });
		await insert([
			["acme/api", "pull:acme/api#1", true],
			["oss/lib", "repo:oss/lib", false],
		]);
		const body = (await (
			await handleChangesRequest(get(`since=${cursor0}&scope=all`), deps)
		).json()) as { entities: string[] };
		expect(body.entities).toEqual(["repo:oss/lib"]);
	});

	it("limits results to watched repos", async () => {
		const { deps, insert } = setup({ readable: ["acme/api", "acme/web"] });
		await insert([
			["acme/api", "pull:acme/api#1", true],
			["acme/web", "pull:acme/web#2", true],
			["acme/web", "notifications", true],
		]);
		const body = (await (
			await handleChangesRequest(get(`since=${cursor0}&repos=ACME/Api`), deps)
		).json()) as { entities: string[] };
		expect(body.entities).toEqual(["pull:acme/api#1"]);
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
});
