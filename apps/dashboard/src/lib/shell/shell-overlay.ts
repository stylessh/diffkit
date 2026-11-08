import { useSyncExternalStore } from "react";
import type { CreateActionId } from "./create-actions";

export type RepoPickerIntent =
	| { kind: "open" }
	| { kind: "pin" }
	| { kind: "create"; action: CreateActionId };

export type ShellOverlay =
	| { kind: "none" }
	| { kind: "command-palette" }
	| { kind: "repo-picker"; intent: RepoPickerIntent };

const NONE: ShellOverlay = { kind: "none" };

let overlay: ShellOverlay = NONE;
const listeners = new Set<() => void>();

function transition(next: ShellOverlay) {
	if (next === overlay) return;
	overlay = next;
	for (const listener of listeners) listener();
}

export function openCommandPalette() {
	transition({ kind: "command-palette" });
}

export function toggleCommandPalette() {
	transition(
		overlay.kind === "command-palette" ? NONE : { kind: "command-palette" },
	);
}

export function openRepoPicker(intent: RepoPickerIntent) {
	transition({ kind: "repo-picker", intent });
}

export function closeShellOverlay() {
	transition(NONE);
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useShellOverlay(): ShellOverlay {
	return useSyncExternalStore(
		subscribe,
		() => overlay,
		() => NONE,
	);
}
