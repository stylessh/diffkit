import "@tanstack/react-start/server-only";
import { siteConfig } from "./site-config";

const STARS_KEY = "landing:repository-stars";
/** The key is rewritten on every refresh, so it only expires with no visitors at all. */
const STARS_TTL_SECONDS = 7 * 24 * 60 * 60;
const STARS_REFRESH_AFTER_MS = 60 * 60 * 1000;
const GITHUB_TIMEOUT_MS = 5_000;

type StarsEntry = { count: number | null; checkedAt: number };

type StarsDeps = {
	kv: Pick<KVNamespace, "get" | "put">;
	fetchCount: () => Promise<number | null>;
	defer: (work: Promise<unknown>) => void;
	now?: number;
};

let refreshInFlight: Promise<void> | null = null;

/**
 * The landing page's star count. It never waits on GitHub: the answer comes
 * from KV, and a refresh runs behind the response at most once an hour whether
 * it succeeds or not, so a rate-limited GitHub is not retried on every view.
 */
export async function readRepositoryStars({
	kv,
	fetchCount,
	defer,
	now = Date.now(),
}: StarsDeps): Promise<number | null> {
	const entry = await kv
		.get<StarsEntry>(STARS_KEY, "json")
		.catch((): null => null);

	if (!entry || now - entry.checkedAt >= STARS_REFRESH_AFTER_MS) {
		refreshInFlight ??= refresh({ kv, fetchCount, now }, entry).finally(() => {
			refreshInFlight = null;
		});
		defer(refreshInFlight);
	}
	return entry?.count ?? null;
}

async function refresh(
	{
		kv,
		fetchCount,
		now,
	}: Pick<StarsDeps, "kv" | "fetchCount"> & { now: number },
	previous: StarsEntry | null,
) {
	const fetched = await fetchCount().catch((): null => null);
	const next: StarsEntry = {
		count: fetched ?? previous?.count ?? null,
		checkedAt: now,
	};
	await kv
		.put(STARS_KEY, JSON.stringify(next), { expirationTtl: STARS_TTL_SECONDS })
		.catch((error) => {
			console.warn("[stars] cache write failed", error);
		});
}

export async function fetchRepositoryStars(): Promise<number | null> {
	const { pathname } = new URL(siteConfig.githubRepositoryUrl);
	const response = await fetch(`https://api.github.com/repos${pathname}`, {
		headers: {
			Accept: "application/vnd.github+json",
			"User-Agent": siteConfig.name,
		},
		signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
	});
	if (!response.ok) return null;
	const { stargazers_count: count } = (await response.json()) as {
		stargazers_count?: unknown;
	};
	return typeof count === "number" ? count : null;
}
