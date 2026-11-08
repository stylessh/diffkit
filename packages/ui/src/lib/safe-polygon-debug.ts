import type {
	SafePolygonPoint,
	SafePolygonRect,
	SafePolygonSide,
} from "./safe-polygon";

export type SafePolygonDebugSnapshot = {
	ownerId: symbol;
	polygon: readonly SafePolygonPoint[];
	pointer: SafePolygonPoint;
	sourceRect: SafePolygonRect;
	destinationRect: SafePolygonRect;
	side: SafePolygonSide;
};

let enabled = false;
let snapshot: SafePolygonDebugSnapshot | null = null;
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

export function setSafePolygonDebugEnabled(nextEnabled: boolean) {
	enabled = nextEnabled;
	if (!enabled && snapshot) {
		snapshot = null;
		emit();
	}
}

export function publishSafePolygonDebug(next: SafePolygonDebugSnapshot) {
	if (!enabled) return;
	snapshot = next;
	emit();
}

export function clearSafePolygonDebug(ownerId?: symbol) {
	if (!snapshot || (ownerId && snapshot.ownerId !== ownerId)) return;
	snapshot = null;
	emit();
}

export function getSafePolygonDebugSnapshot() {
	return snapshot;
}

export function subscribeToSafePolygonDebug(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
