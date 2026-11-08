import "@tanstack/react-start/server-only";
import { env, waitUntil } from "cloudflare:workers";

/**
 * Repos the viewer can read through the GitHub App, for `/api/changes`.
 *
 * Unlike the installation access index (which records that an installation
 * covers "all" repos of an owner), this lists the repositories the *user* can
 * access in each installation (`GET /user/installations/{id}/repositories`),
 * so an org member never receives entity keys for private repos they can't
 * see. OAuth-only repos are not included; they refresh on focus instead.
 *
 * Cached per user in memory (60 s) and in KV under `change-access:v1:` with a
 * 10-minute `expirationTtl` (no sweeper needed). KV failures are cache misses.
 * GitHub failures fail closed: an empty set, not cached.
 */

const KV_PREFIX = "change-access:v1:";
const KV_TTL_SECONDS = 10 * 60;
const MEMORY_TTL_MS = 60 * 1000;
const PAGE_SIZE = 100;
const MAX_INSTALLATION_PAGES = 3;
/** Per installation; larger installations are truncated (focus refetch). */
const MAX_REPO_PAGES = 10;

type ReadableRepos = { repos: string[]; truncated: boolean };

const memory = new Map<string, { value: ReadableRepos; expiresAt: number }>();

type MinimalOctokit = {
	request: (
		route: string,
		params?: Record<string, unknown>,
	) => Promise<{ data: unknown }>;
};

export async function listReadableRepos(
	octokit: MinimalOctokit,
): Promise<ReadableRepos> {
	const installations: { id: number }[] = [];
	for (let page = 1; page <= MAX_INSTALLATION_PAGES; page++) {
		const { data } = await octokit.request("GET /user/installations", {
			per_page: PAGE_SIZE,
			page,
		});
		const items =
			(data as { installations?: { id?: number; suspended_at?: unknown }[] })
				.installations ?? [];
		for (const item of items) {
			if (typeof item.id === "number" && !item.suspended_at) {
				installations.push({ id: item.id });
			}
		}
		if (items.length < PAGE_SIZE) break;
	}

	const repos = new Set<string>();
	let truncated = false;
	for (const installation of installations) {
		for (let page = 1; page <= MAX_REPO_PAGES; page++) {
			const { data } = await octokit.request(
				"GET /user/installations/{installation_id}/repositories",
				{ installation_id: installation.id, per_page: PAGE_SIZE, page },
			);
			const items =
				(data as { repositories?: { full_name?: string }[] }).repositories ??
				[];
			for (const item of items) {
				if (typeof item.full_name === "string") {
					repos.add(item.full_name.toLowerCase());
				}
			}
			if (items.length < PAGE_SIZE) break;
			if (page === MAX_REPO_PAGES) truncated = true;
		}
	}
	return { repos: [...repos], truncated };
}

async function readKv(userId: string): Promise<ReadableRepos | null> {
	try {
		return await env.GITHUB_CACHE_KV.get<ReadableRepos>(
			`${KV_PREFIX}${userId}`,
			"json",
		);
	} catch {
		return null;
	}
}

function writeKv(userId: string, value: ReadableRepos) {
	try {
		waitUntil(
			env.GITHUB_CACHE_KV.put(`${KV_PREFIX}${userId}`, JSON.stringify(value), {
				expirationTtl: KV_TTL_SECONDS,
			}).catch((error) => {
				console.warn("[change-access] KV write failed", error);
			}),
		);
	} catch {
		// No request context: skip caching.
	}
}

export async function getReadableRepoSet(userId: string): Promise<Set<string>> {
	const now = Date.now();
	const cached = memory.get(userId);
	if (cached && cached.expiresAt > now) {
		return new Set(cached.value.repos);
	}

	let value = await readKv(userId);
	if (!value) {
		try {
			const { getGitHubAppUserClientByUserId } = await import("./auth-runtime");
			const octokit = await getGitHubAppUserClientByUserId(userId);
			if (!octokit) return new Set();
			value = await listReadableRepos(octokit as unknown as MinimalOctokit);
			writeKv(userId, value);
		} catch (error) {
			console.warn("[change-access] failed to list readable repos", error);
			return new Set();
		}
	}

	memory.set(userId, { value, expiresAt: now + MEMORY_TTL_MS });
	if (memory.size > 1000) {
		for (const [key, entry] of memory) {
			if (entry.expiresAt <= now) memory.delete(key);
		}
	}
	return new Set(value.repos);
}

/** Drop a user's cached access (e.g. after an installation webhook). */
export function forgetReadableRepos(userId: string) {
	memory.delete(userId);
}
