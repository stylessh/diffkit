import { useSyncExternalStore } from "react";

export type TabType =
	| "pull"
	| "issue"
	| "review"
	| "repo"
	| "commit"
	| "actions";

export interface Tab {
	id: string;
	type: TabType;
	title: string;
	number?: number;
	url: string;
	repo: string;
	iconColor: string;
	avatarUrl?: string;
	additions?: number;
	deletions?: number;
	merged?: boolean;
}

export const TABS_STORAGE_KEY = "diffkit:tabs";

const VALID_TAB_TYPES = {
	pull: true,
	issue: true,
	review: true,
	repo: true,
	commit: true,
	actions: true,
} satisfies Record<TabType, true>;

function isValidTabType(type: unknown): type is TabType {
	return typeof type === "string" && type in VALID_TAB_TYPES;
}

function isValidTab(t: unknown): t is Tab {
	return (
		t !== null &&
		typeof t === "object" &&
		typeof (t as Tab).id === "string" &&
		isValidTabType((t as Tab).type)
	);
}

export function readStoredTabs(): Tab[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(TABS_STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed) || !parsed.every(isValidTab)) {
			localStorage.removeItem(TABS_STORAGE_KEY);
			return [];
		}
		return parsed;
	} catch {
		localStorage.removeItem(TABS_STORAGE_KEY);
		return [];
	}
}

function persistTabs() {
	try {
		localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
	} catch {}
}

let tabs: Tab[] = readStoredTabs();
const listeners = new Set<() => void>();

function emitChange() {
	persistTabs();
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return tabs;
}

export function addTab(tab: Tab) {
	const existing = tabs.find((t) => t.id === tab.id);
	if (existing) {
		// Update if any field changed (e.g. URL when navigating between PR detail and review)
		if (
			existing.url === tab.url &&
			existing.title === tab.title &&
			existing.iconColor === tab.iconColor &&
			existing.additions === tab.additions &&
			existing.deletions === tab.deletions &&
			existing.merged === tab.merged
		)
			return;
		tabs = tabs.map((t) => (t.id === tab.id ? tab : t));
		emitChange();
		return;
	}
	tabs = [...tabs, tab];
	emitChange();
}

export function removeTab(id: string) {
	tabs = tabs.filter((t) => t.id !== id);
	emitChange();
}

export function removeOtherTabs(id: string) {
	tabs = tabs.filter((t) => t.id === id);
	emitChange();
}

export function removeTabsToRight(id: string) {
	const index = tabs.findIndex((t) => t.id === id);
	if (index === -1) return;
	tabs = tabs.slice(0, index + 1);
	emitChange();
}

export function isMergedTab(t: Tab): boolean {
	return (
		t.merged === true ||
		((t.type === "pull" || t.type === "review") &&
			t.iconColor === "text-purple-500")
	);
}

export function removeMergedTabs() {
	const next = tabs.filter((t) => !isMergedTab(t));
	if (next.length === tabs.length) return;
	tabs = next;
	emitChange();
}

export function reorderTabs(newOrder: Tab[]) {
	tabs = newOrder;
	emitChange();
}

const emptyTabs: Tab[] = [];

export function useTabs() {
	return useSyncExternalStore(subscribe, getSnapshot, () => emptyTabs);
}
