import { useSyncExternalStore } from "react";

let now = Date.now();
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function tick() {
	now = Date.now();
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (intervalId === null) {
		intervalId = setInterval(tick, 1000);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	};
}

function getSnapshot() {
	return now;
}

function getServerSnapshot() {
	return 0;
}

export function useNow(): number {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
