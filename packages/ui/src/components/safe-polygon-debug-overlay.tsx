"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
	getSafePolygonDebugSnapshot,
	setSafePolygonDebugEnabled,
	subscribeToSafePolygonDebug,
} from "../lib/safe-polygon-debug";

const EMPTY_SNAPSHOT = null;

export function SafePolygonDebugOverlay({ enabled }: { enabled: boolean }) {
	const snapshot = useSyncExternalStore(
		subscribeToSafePolygonDebug,
		getSafePolygonDebugSnapshot,
		() => EMPTY_SNAPSHOT,
	);

	useEffect(() => {
		setSafePolygonDebugEnabled(enabled);
		return () => setSafePolygonDebugEnabled(false);
	}, [enabled]);

	if (!enabled || typeof document === "undefined") return null;

	return createPortal(
		<div
			aria-hidden="true"
			data-safe-polygon-debug-overlay=""
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 2_147_483_647,
				pointerEvents: "none",
			}}
		>
			{snapshot ? (
				<svg
					width="100%"
					height="100%"
					style={{ position: "absolute", inset: 0, overflow: "visible" }}
				>
					<title>Active safe triangle</title>
					<rect
						x={snapshot.sourceRect.left}
						y={snapshot.sourceRect.top}
						width={snapshot.sourceRect.right - snapshot.sourceRect.left}
						height={snapshot.sourceRect.bottom - snapshot.sourceRect.top}
						fill="none"
						stroke="rgba(244, 63, 94, 0.8)"
						strokeDasharray="4 3"
					/>
					<rect
						x={snapshot.destinationRect.left}
						y={snapshot.destinationRect.top}
						width={
							snapshot.destinationRect.right - snapshot.destinationRect.left
						}
						height={
							snapshot.destinationRect.bottom - snapshot.destinationRect.top
						}
						fill="none"
						stroke="rgba(244, 63, 94, 0.8)"
						strokeDasharray="4 3"
					/>
					<polygon
						points={snapshot.polygon
							.map((point) => `${point.x},${point.y}`)
							.join(" ")}
						fill="rgba(244, 63, 94, 0.22)"
						stroke="rgba(244, 63, 94, 0.95)"
						strokeWidth={1.5}
					/>
					<circle
						cx={snapshot.pointer.x}
						cy={snapshot.pointer.y}
						r={4}
						fill="rgb(244, 63, 94)"
						stroke="white"
						strokeWidth={1.5}
					/>
				</svg>
			) : null}
			<div
				style={{
					position: "absolute",
					left: 12,
					bottom: 12,
					border: "1px solid rgba(244, 63, 94, 0.45)",
					borderRadius: 8,
					background: "rgba(24, 24, 27, 0.92)",
					boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
					color: "white",
					font: "500 12px/1.4 ui-monospace, SFMono-Regular, monospace",
					padding: "7px 9px",
				}}
			>
				Safe triangles · {snapshot ? `${snapshot.side} · active` : "waiting"}
			</div>
		</div>,
		document.body,
	);
}
