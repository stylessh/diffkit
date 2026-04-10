import { useSyncExternalStore } from "react";

export type GitHubAccessPrompt = {
	source: "onboarding" | "warning";
	owner?: string;
	repo?: string;
	fallbackHref?: string;
};

let prompt: GitHubAccessPrompt | null = null;
const listeners = new Set<() => void>();

function emitChange() {
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return prompt;
}

export function openGitHubAccessPrompt(nextPrompt: GitHubAccessPrompt) {
	prompt = nextPrompt;
	emitChange();
}

export function closeGitHubAccessPrompt() {
	if (!prompt) {
		return;
	}

	prompt = null;
	emitChange();
}

export function useGitHubAccessPrompt() {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
