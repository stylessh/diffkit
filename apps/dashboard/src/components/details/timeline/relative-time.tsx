import { useSyncExternalStore } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";

const TICK_MS = 30_000;

let now = Date.now();
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (intervalId === null) {
		now = Date.now();
		intervalId = setInterval(() => {
			now = Date.now();
			for (const notify of listeners) notify();
		}, TICK_MS);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	};
}

const getSnapshot = () => now;

/**
 * Timeline rows are memoized, so a timestamp can no longer rely on its row
 * re-rendering to stay current: each one follows a shared half-minute tick.
 */
export function RelativeTime({ date }: { date: string }) {
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	return formatRelativeTime(date);
}
