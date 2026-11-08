import type { Octokit } from "octokit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => {
	const kv = {
		get: vi.fn(),
		put: vi.fn(),
	};
	return { kv, env: { GITHUB_CACHE_KV: kv }, waitUntil: vi.fn() };
});
const getClient = vi.hoisted(() => vi.fn());

vi.mock("cloudflare:workers", () => ({
	env: runtime.env,
	waitUntil: runtime.waitUntil,
}));
vi.mock("./auth-runtime", () => ({
	getGitHubAppUserClientByUserId: getClient,
}));

type Page = Record<string, unknown>;

function asClient(fake: { request: unknown }) {
	return fake as unknown as Pick<Octokit, "request">;
}

function fakeOctokit(options: {
	installations?: Array<{ id: number; suspended_at?: string | null }>;
	repos?: Record<number, string[]>;
	pageSize?: number;
}) {
	const request = vi.fn(async (route: string, params: Page = {}) => {
		const page = Number(params.page ?? 1);
		const size = Number(params.per_page ?? 100);
		if (route === "GET /user/installations") {
			const all = options.installations ?? [];
			return {
				data: { installations: all.slice((page - 1) * size, page * size) },
			};
		}
		if (route === "GET /user/installations/{installation_id}/repositories") {
			const all = options.repos?.[Number(params.installation_id)] ?? [];
			return {
				data: {
					repositories: all
						.slice((page - 1) * size, page * size)
						.map((full_name) => ({ full_name })),
				},
			};
		}
		throw new Error(`unexpected route ${route}`);
	});
	return asClient({ request });
}

async function load() {
	vi.resetModules();
	return import("./github-change-access.server");
}

beforeEach(() => {
	runtime.kv.get.mockReset().mockResolvedValue(null);
	runtime.kv.put.mockReset().mockResolvedValue(undefined);
	runtime.waitUntil.mockReset();
	getClient.mockReset();
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("listReadableRepos", () => {
	it("lists the repos of every active installation, lowercased and de-duplicated", async () => {
		const { listReadableRepos } = await load();
		const octokit = fakeOctokit({
			installations: [
				{ id: 1 },
				{ id: 2 },
				{ id: 3, suspended_at: "2026-01-01" },
			],
			repos: {
				1: ["Acme/Api", "acme/web"],
				2: ["ACME/api", "Other/Lib"],
				3: ["Suspended/Repo"],
			},
		});
		const result = await listReadableRepos(octokit);
		expect(result.repos.sort()).toEqual(["acme/api", "acme/web", "other/lib"]);
	});

	it("pages through installations and repositories", async () => {
		const { listReadableRepos } = await load();
		const repos = Array.from({ length: 250 }, (_, index) => `acme/r${index}`);
		const octokit = fakeOctokit({
			installations: Array.from({ length: 150 }, (_, index) => ({
				id: index + 1,
			})),
			repos: { 1: repos },
		});
		const result = await listReadableRepos(octokit);
		expect(result.repos).toHaveLength(250);
	});
});

describe("getReadableRepoSet", () => {
	it("fetches from GitHub on a miss and caches in memory and KV with a TTL", async () => {
		const { getReadableRepoSet } = await load();
		getClient.mockResolvedValue(
			fakeOctokit({ installations: [{ id: 1 }], repos: { 1: ["Acme/Api"] } }),
		);

		expect([...(await getReadableRepoSet("u1"))]).toEqual(["acme/api"]);
		expect([...(await getReadableRepoSet("u1"))]).toEqual(["acme/api"]);

		expect(getClient).toHaveBeenCalledTimes(1);
		expect(runtime.kv.put).toHaveBeenCalledTimes(1);
		expect(runtime.kv.put).toHaveBeenCalledWith(
			"change-access:v1:u1",
			JSON.stringify({ repos: ["acme/api"] }),
			{ expirationTtl: 600 },
		);
		expect(runtime.waitUntil).toHaveBeenCalledTimes(1);
	});

	it("serves a KV hit without calling GitHub", async () => {
		const { getReadableRepoSet } = await load();
		runtime.kv.get.mockResolvedValue({ repos: ["acme/web"] });
		expect([...(await getReadableRepoSet("u1"))]).toEqual(["acme/web"]);
		expect(getClient).not.toHaveBeenCalled();
		expect(runtime.kv.put).not.toHaveBeenCalled();
	});

	it("treats KV read and write failures as cache misses", async () => {
		const { getReadableRepoSet } = await load();
		runtime.kv.get.mockRejectedValue(new Error("KV unavailable"));
		runtime.kv.put.mockRejectedValue(new Error("KV unavailable"));
		getClient.mockResolvedValue(
			fakeOctokit({ installations: [{ id: 1 }], repos: { 1: ["acme/api"] } }),
		);
		expect([...(await getReadableRepoSet("u1"))]).toEqual(["acme/api"]);
	});

	it("fails closed (no private repos) and does not retry for 30 s, for GitHub errors and for users without the app", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		const { getReadableRepoSet } = await load();
		getClient.mockResolvedValue({
			request: vi.fn(async () => {
				throw new Error("GitHub 502");
			}),
		});

		expect((await getReadableRepoSet("u1")).size).toBe(0);
		expect((await getReadableRepoSet("u1")).size).toBe(0);
		expect(getClient).toHaveBeenCalledTimes(1);
		expect(runtime.kv.put).not.toHaveBeenCalled();

		vi.setSystemTime(Date.now() + 31_000);
		getClient.mockResolvedValue(
			fakeOctokit({ installations: [{ id: 1 }], repos: { 1: ["acme/api"] } }),
		);
		expect([...(await getReadableRepoSet("u1"))]).toEqual(["acme/api"]);

		getClient.mockClear().mockResolvedValue(null);
		await getReadableRepoSet("no-app");
		await getReadableRepoSet("no-app");
		expect(getClient).toHaveBeenCalledTimes(1);
	});

	it("keeps users apart", async () => {
		const { getReadableRepoSet } = await load();
		getClient.mockImplementation(async (userId: string) =>
			fakeOctokit({
				installations: [{ id: 1 }],
				repos: { 1: [userId === "a" ? "acme/a" : "acme/b"] },
			}),
		);
		expect([...(await getReadableRepoSet("a"))]).toEqual(["acme/a"]);
		expect([...(await getReadableRepoSet("b"))]).toEqual(["acme/b"]);
	});

	it("bounds the in-memory cache", async () => {
		const { getReadableRepoSet } = await load();
		getClient.mockResolvedValue(null);
		for (let index = 0; index < 1100; index += 1) {
			await getReadableRepoSet(`user-${index}`);
		}
		expect(getClient).toHaveBeenCalledTimes(1100);
		await getReadableRepoSet("user-1099");
		expect(getClient).toHaveBeenCalledTimes(1100);
		await getReadableRepoSet("user-0");
		expect(getClient).toHaveBeenCalledTimes(1101);
	});
});
