import { useSyncExternalStore } from "react";

export const REPO_NAV_KEYS = [
	"code",
	"commits",
	"branches",
	"tags",
	"releases",
	"pulls",
	"issues",
	"actions",
	"settings",
] as const;

export type RepoNavKey = (typeof REPO_NAV_KEYS)[number];

/** The tabs a repo shows before the overflow menu, until someone picks their own. */
export const DEFAULT_REPO_TABS: readonly RepoNavKey[] = [
	"code",
	"pulls",
	"issues",
	"actions",
	"settings",
];

function isRepoNavKey(value: unknown): value is RepoNavKey {
	return REPO_NAV_KEYS.includes(value as RepoNavKey);
}

/** Saved tabs, or the defaults for anything missing or malformed. Code is always kept. */
export function parseRepoTabs(raw: string | null): readonly RepoNavKey[] {
	if (!raw) return DEFAULT_REPO_TABS;
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return DEFAULT_REPO_TABS;
	}
	if (!Array.isArray(value)) return DEFAULT_REPO_TABS;
	const tabs = new Set<RepoNavKey>(["code"]);
	for (const key of value) if (isRepoNavKey(key)) tabs.add(key);
	return REPO_NAV_KEYS.filter((key) => tabs.has(key));
}

export function withTabToggled(
	tabs: readonly RepoNavKey[],
	key: RepoNavKey,
): readonly RepoNavKey[] {
	if (key === "code") return tabs;
	const next = new Set(tabs);
	if (next.has(key)) next.delete(key);
	else next.add(key);
	return REPO_NAV_KEYS.filter((candidate) => next.has(candidate));
}

const STORAGE_PREFIX = "diffkit:repo-tabs:";
const snapshots = new Map<string, readonly RepoNavKey[]>();
const listeners = new Set<() => void>();

function readSnapshot(userId: string) {
	const cached = snapshots.get(userId);
	if (cached) return cached;
	let raw: string | null = null;
	try {
		raw = window.localStorage.getItem(STORAGE_PREFIX + userId);
	} catch {}
	const next = parseRepoTabs(raw);
	snapshots.set(userId, next);
	return next;
}

function handleStorageEvent(event: StorageEvent) {
	if (!event.key?.startsWith(STORAGE_PREFIX)) return;
	snapshots.clear();
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (listeners.size === 1) {
		window.addEventListener("storage", handleStorageEvent);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			window.removeEventListener("storage", handleStorageEvent);
		}
	};
}

export function toggleRepoTab(userId: string, key: RepoNavKey) {
	const current = readSnapshot(userId);
	const next = withTabToggled(current, key);
	if (next === current) return;
	snapshots.set(userId, next);
	try {
		window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(next));
	} catch {}
	for (const listener of listeners) listener();
}

/** The repo tabs this person keeps in the bar; the rest sit behind the overflow menu. */
export function useRepoTabs(userId: string): readonly RepoNavKey[] {
	return useSyncExternalStore(
		subscribe,
		() => readSnapshot(userId),
		() => DEFAULT_REPO_TABS,
	);
}
