import { useSyncExternalStore } from "react";

export type TabType = "pull" | "issue" | "review";

export interface Tab {
	id: string;
	type: TabType;
	title: string;
	number: number;
	url: string;
	repo: string;
	iconColor: string;
	additions?: number;
	deletions?: number;
}

export const TABS_STORAGE_KEY = "diffkit:tabs";

export function readStoredTabs(): Tab[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(TABS_STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
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
			existing.deletions === tab.deletions
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

const emptyTabs: Tab[] = [];

export function useTabs() {
	return useSyncExternalStore(subscribe, getSnapshot, () => emptyTabs);
}
