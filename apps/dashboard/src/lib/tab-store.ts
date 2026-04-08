import { useSyncExternalStore } from "react";

export type TabType = "pull" | "issue";

export interface Tab {
	id: string;
	type: TabType;
	title: string;
	number: number;
	url: string;
	repo: string;
	iconColor: string;
}

const STORAGE_KEY = "quickhub:tabs";

function loadTabs(): Tab[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function persistTabs() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
	} catch {}
}

let tabs: Tab[] = loadTabs();
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
	if (tabs.some((t) => t.id === tab.id)) return;
	tabs = [...tabs, tab];
	emitChange();
}

export function removeTab(id: string) {
	tabs = tabs.filter((t) => t.id !== id);
	emitChange();
}

export function useTabs() {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
