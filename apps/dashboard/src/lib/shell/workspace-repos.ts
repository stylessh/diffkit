import { useSyncExternalStore } from "react";

export type RepoRef = { owner: string; name: string };

export type WorkspaceRepos = {
	pinned: RepoRef[];
	recent: RepoRef[];
};

export const MAX_PINNED_REPOS = 12;
export const MAX_RECENT_REPOS = 6;

const EMPTY: WorkspaceRepos = { pinned: [], recent: [] };

export function repoFullName(repo: RepoRef) {
	return `${repo.owner}/${repo.name}`;
}

function sameRepo(a: RepoRef, b: RepoRef) {
	return repoFullName(a).toLowerCase() === repoFullName(b).toLowerCase();
}

function isRepoRef(value: unknown): value is RepoRef {
	if (typeof value !== "object" || value === null) return false;
	const { owner, name } = value as Record<string, unknown>;
	return (
		typeof owner === "string" &&
		typeof name === "string" &&
		owner.length > 0 &&
		name.length > 0
	);
}

function readRepoList(value: unknown, limit: number): RepoRef[] {
	if (!Array.isArray(value)) return [];
	const repos: RepoRef[] = [];
	for (const item of value) {
		if (!isRepoRef(item) || repos.some((repo) => sameRepo(repo, item))) {
			continue;
		}
		repos.push({ owner: item.owner, name: item.name });
		if (repos.length === limit) break;
	}
	return repos;
}

export function parseWorkspaceRepos(raw: string | null): WorkspaceRepos {
	if (!raw) return EMPTY;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return EMPTY;
		const { pinned, recent } = parsed as Record<string, unknown>;
		return {
			pinned: readRepoList(pinned, MAX_PINNED_REPOS),
			recent: readRepoList(recent, MAX_RECENT_REPOS),
		};
	} catch {
		return EMPTY;
	}
}

export function isRepoPinned(state: WorkspaceRepos, repo: RepoRef) {
	return state.pinned.some((pinned) => sameRepo(pinned, repo));
}

export function canPinMoreRepos(state: WorkspaceRepos) {
	return state.pinned.length < MAX_PINNED_REPOS;
}

export function withRecentRepo(
	state: WorkspaceRepos,
	repo: RepoRef,
): WorkspaceRepos {
	const first = state.recent[0];
	if (first && first.owner === repo.owner && first.name === repo.name) {
		return state;
	}
	const rest = state.recent.filter((recent) => !sameRepo(recent, repo));
	return {
		...state,
		recent: [repo, ...rest].slice(0, MAX_RECENT_REPOS),
	};
}

export function withPinnedRepo(
	state: WorkspaceRepos,
	repo: RepoRef,
): WorkspaceRepos {
	if (isRepoPinned(state, repo) || !canPinMoreRepos(state)) return state;
	return { ...state, pinned: [...state.pinned, repo] };
}

export function withoutPinnedRepo(
	state: WorkspaceRepos,
	repo: RepoRef,
): WorkspaceRepos {
	if (!isRepoPinned(state, repo)) return state;
	return {
		...state,
		pinned: state.pinned.filter((pinned) => !sameRepo(pinned, repo)),
	};
}

export function withPinToggled(
	state: WorkspaceRepos,
	repo: RepoRef,
): WorkspaceRepos {
	return isRepoPinned(state, repo)
		? withoutPinnedRepo(state, repo)
		: withPinnedRepo(state, repo);
}

function storageKey(userId: string) {
	return `diffkit:workspace-repos:${userId}`;
}

const snapshots = new Map<string, WorkspaceRepos>();
const listeners = new Set<() => void>();

function readSnapshot(userId: string): WorkspaceRepos {
	const cached = snapshots.get(userId);
	if (cached) return cached;
	let raw: string | null = null;
	try {
		raw = window.localStorage.getItem(storageKey(userId));
	} catch {}
	const next = parseWorkspaceRepos(raw);
	snapshots.set(userId, next);
	return next;
}

function notify() {
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

function handleStorageEvent(event: StorageEvent) {
	if (!event.key?.startsWith("diffkit:workspace-repos:")) return;
	snapshots.clear();
	notify();
}

export function updateWorkspaceRepos(
	userId: string,
	update: (state: WorkspaceRepos) => WorkspaceRepos,
) {
	const current = readSnapshot(userId);
	const next = update(current);
	if (next === current) return;
	snapshots.set(userId, next);
	try {
		window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
	} catch {}
	notify();
}

export function useWorkspaceRepos(userId: string): WorkspaceRepos {
	return useSyncExternalStore(
		subscribe,
		() => readSnapshot(userId),
		() => EMPTY,
	);
}
