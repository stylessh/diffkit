import "@tanstack/react-start/server-only";
import { env, waitUntil } from "cloudflare:workers";
import type { Octokit } from "octokit";
import { describeError } from "./route-safety.server";

// Lists what the *user* can read in each installation, not the installation's
// "all repos" coverage, so an org member never receives keys for private repos
// they cannot see. Failures fail closed to public repos only. Every cache here
// expires on its own (the incident rule: no store without a TTL).

const KV_PREFIX = "change-access:v1:";
const KV_TTL_SECONDS = 10 * 60;
const MEMORY_TTL_MS = 60 * 1000;
const FAILURE_MEMORY_TTL_MS = 30 * 1000;
const MEMORY_MAX_ENTRIES = 1000;
const PAGE_SIZE = 100;
const MAX_INSTALLATION_PAGES = 3;
// Larger installations are truncated; those users refetch on focus.
const MAX_REPO_PAGES = 10;

type ReadableRepos = { repos: string[] };

const NO_READABLE_REPOS: ReadableRepos = { repos: [] };

const memory = new Map<string, { value: ReadableRepos; expiresAt: number }>();

function remember(
	userId: string,
	value: ReadableRepos,
	ttlMs: number,
	now: number,
) {
	memory.delete(userId);
	memory.set(userId, { value, expiresAt: now + ttlMs });
	if (memory.size <= MEMORY_MAX_ENTRIES) return;
	for (const [key, entry] of memory) {
		if (entry.expiresAt <= now) memory.delete(key);
	}
	// Maps iterate in insertion order, so the oldest entries go first.
	for (const key of memory.keys()) {
		if (memory.size <= MEMORY_MAX_ENTRIES) break;
		memory.delete(key);
	}
}

export async function listReadableRepos(
	octokit: Pick<Octokit, "request">,
): Promise<ReadableRepos> {
	const installations: { id: number }[] = [];
	for (let page = 1; page <= MAX_INSTALLATION_PAGES; page++) {
		const { data } = await octokit.request("GET /user/installations", {
			per_page: PAGE_SIZE,
			page,
		});
		const items = data.installations ?? [];
		for (const item of items) {
			if (!item.suspended_at) installations.push({ id: item.id });
		}
		if (items.length < PAGE_SIZE) break;
	}

	const repos = new Set<string>();
	for (const installation of installations) {
		for (let page = 1; page <= MAX_REPO_PAGES; page++) {
			const { data } = await octokit.request(
				"GET /user/installations/{installation_id}/repositories",
				{ installation_id: installation.id, per_page: PAGE_SIZE, page },
			);
			const items = data.repositories ?? [];
			for (const item of items) {
				repos.add(item.full_name.toLowerCase());
			}
			if (items.length < PAGE_SIZE) break;
		}
	}
	return { repos: [...repos] };
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
				console.warn("[change-access] KV write failed", describeError(error));
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
			if (!octokit) {
				remember(userId, NO_READABLE_REPOS, FAILURE_MEMORY_TTL_MS, now);
				return new Set();
			}
			value = await listReadableRepos(octokit);
			writeKv(userId, value);
		} catch (error) {
			console.warn(
				"[change-access] failed to list readable repos",
				describeError(error),
			);
			remember(userId, NO_READABLE_REPOS, FAILURE_MEMORY_TTL_MS, now);
			return new Set();
		}
	}

	remember(userId, value, MEMORY_TTL_MS, now);
	return new Set(value.repos);
}
