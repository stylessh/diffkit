"use client";

import { useCallback, useEffect, useRef } from "react";
import {
	createSafePolygon,
	getSubmenuSide,
	isMovingTowardSubmenu,
	isPointInSafePolygon,
	isPointInSafePolygonRect,
	type SafePolygonPoint,
	type SafePolygonSide,
	toSafePolygonRect,
} from "../lib/safe-polygon";
import {
	clearSafePolygonDebug,
	publishSafePolygonDebug,
} from "../lib/safe-polygon-debug";

type ActiveSafePolygon = {
	source: HTMLElement;
	destination: HTMLElement;
	exitPoint: SafePolygonPoint;
	lastPoint: SafePolygonPoint;
	side?: SafePolygonSide;
	expiresAt: number;
};

export type SafePolygonActivation = {
	event: Pick<PointerEvent, "clientX" | "clientY" | "pointerType">;
	source: HTMLElement;
	destination: HTMLElement;
	side?: SafePolygonSide;
};

export type UseSafePolygonOptions = {
	buffer?: number;
	timeoutMs?: number;
	onTimeout?: () => void;
};

const DEFAULT_BUFFER_PX = 8;
const DEFAULT_TIMEOUT_MS = 500;

export function useSafePolygon({
	buffer = DEFAULT_BUFFER_PX,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	onTimeout,
}: UseSafePolygonOptions = {}) {
	const ownerIdRef = useRef(Symbol("safe-polygon"));
	const activeRef = useRef<ActiveSafePolygon | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onTimeoutRef = useRef(onTimeout);
	onTimeoutRef.current = onTimeout;

	const cancel = useCallback(() => {
		activeRef.current = null;
		if (timerRef.current !== null) clearTimeout(timerRef.current);
		timerRef.current = null;
		clearSafePolygonDebug(ownerIdRef.current);
	}, []);

	const expire = useCallback(() => {
		if (!activeRef.current) return;
		activeRef.current = null;
		if (timerRef.current !== null) clearTimeout(timerRef.current);
		timerRef.current = null;
		clearSafePolygonDebug(ownerIdRef.current);
		onTimeoutRef.current?.();
	}, []);

	const evaluatePointer = useCallback(
		(event: Pick<PointerEvent, "clientX" | "clientY" | "pointerType">) => {
			const active = activeRef.current;
			if (!active) return false;
			if (event.pointerType !== "mouse") {
				cancel();
				return false;
			}
			if (performance.now() >= active.expiresAt) {
				expire();
				return false;
			}

			const point = { x: event.clientX, y: event.clientY };
			const sourceRect = toSafePolygonRect(
				active.source.getBoundingClientRect(),
			);
			const destinationRect = toSafePolygonRect(
				active.destination.getBoundingClientRect(),
			);
			const side = active.side ?? getSubmenuSide(sourceRect, destinationRect);
			const polygon = createSafePolygon(
				active.exitPoint,
				destinationRect,
				side,
				buffer,
			);

			if (
				isPointInSafePolygonRect(point, sourceRect) ||
				isPointInSafePolygonRect(point, destinationRect)
			) {
				cancel();
				return false;
			}

			if (
				!isMovingTowardSubmenu(active.lastPoint, point, side) ||
				!isPointInSafePolygon(point, polygon)
			) {
				cancel();
				return false;
			}

			active.lastPoint = point;
			publishSafePolygonDebug({
				ownerId: ownerIdRef.current,
				polygon,
				pointer: point,
				sourceRect,
				destinationRect,
				side,
			});
			return true;
		},
		[buffer, cancel, expire],
	);

	const activate = useCallback(
		({ event, source, destination, side }: SafePolygonActivation) => {
			if (event.pointerType !== "mouse") {
				cancel();
				return;
			}

			const point = { x: event.clientX, y: event.clientY };
			activeRef.current = {
				source,
				destination,
				exitPoint: point,
				lastPoint: point,
				side,
				expiresAt: performance.now() + timeoutMs,
			};

			if (timerRef.current !== null) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(expire, timeoutMs);

			const sourceRect = toSafePolygonRect(source.getBoundingClientRect());
			const destinationRect = toSafePolygonRect(
				destination.getBoundingClientRect(),
			);
			const resolvedSide = side ?? getSubmenuSide(sourceRect, destinationRect);
			publishSafePolygonDebug({
				ownerId: ownerIdRef.current,
				polygon: createSafePolygon(
					point,
					destinationRect,
					resolvedSide,
					buffer,
				),
				pointer: point,
				sourceRect,
				destinationRect,
				side: resolvedSide,
			});
		},
		[buffer, cancel, expire, timeoutMs],
	);

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			if (activeRef.current) evaluatePointer(event);
		};

		window.addEventListener("pointermove", handlePointerMove, {
			capture: true,
			passive: true,
		});
		return () => {
			window.removeEventListener("pointermove", handlePointerMove, true);
			cancel();
		};
	}, [cancel, evaluatePointer]);

	return {
		activate,
		cancel,
		shouldHold: evaluatePointer,
	};
}
