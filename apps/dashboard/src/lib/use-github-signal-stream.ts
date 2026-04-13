import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { debug } from "./debug";
import { getRevalidationSignalTimestamps } from "./github.functions";

export type GitHubSignalStreamTarget = {
	queryKey: QueryKey;
	signalKeys: readonly string[];
};

type SignalMessage = {
	type: "signals";
	keys: string[];
};

function isSignalMessage(data: unknown): data is SignalMessage {
	return (
		typeof data === "object" &&
		data !== null &&
		"type" in data &&
		data.type === "signals" &&
		"keys" in data &&
		Array.isArray(data.keys)
	);
}

const RECONNECT_DELAY_MS = 3_000;
const POLL_INTERVAL_MS = 5 * 60 * 1_000;

function getWebSocketUrl() {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/api/ws/signals`;
}

export function invalidateTargets(
	queryClient: ReturnType<typeof useQueryClient>,
	targets: readonly GitHubSignalStreamTarget[],
	receivedKeys: Set<string>,
	source: string,
) {
	let invalidatedCount = 0;

	for (const target of targets) {
		const matchedKeys = target.signalKeys.filter((key) =>
			receivedKeys.has(key),
		);
		if (matchedKeys.length === 0) continue;

		const queryState = queryClient.getQueryState(target.queryKey);
		if (
			!queryState ||
			queryState.dataUpdatedAt === 0 ||
			queryState.fetchStatus === "fetching"
		) {
			debug(source, "skipping query (no data or already fetching)", {
				queryKey: target.queryKey,
				matchedKeys,
				reason: !queryState
					? "no-state"
					: queryState.dataUpdatedAt === 0
						? "no-data"
						: "fetching",
			});
			continue;
		}

		debug(source, "invalidating query", {
			queryKey: target.queryKey,
			matchedKeys,
		});

		void queryClient.invalidateQueries({
			queryKey: target.queryKey,
			exact: true,
			refetchType: "active",
		});
		invalidatedCount++;
	}

	return invalidatedCount;
}

function useGitHubSignalStreamWebSocket(
	targets: readonly GitHubSignalStreamTarget[],
	signalKeysKey: string,
) {
	const queryClient = useQueryClient();
	const targetsRef = useRef(targets);
	targetsRef.current = targets;

	useEffect(() => {
		if (signalKeysKey.length === 0) {
			return;
		}

		const keys = signalKeysKey.split(",");
		let ws: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let disposed = false;

		function sendSubscription(socket: WebSocket) {
			if (socket.readyState === WebSocket.OPEN) {
				debug("github-signal-stream", "subscribing to signal keys", {
					keys,
				});
				socket.send(JSON.stringify({ type: "subscribe", keys }));
			}
		}

		function handleMessage(event: MessageEvent) {
			if (typeof event.data !== "string") return;

			let message: unknown;
			try {
				message = JSON.parse(event.data);
			} catch {
				debug("github-signal-stream", "received malformed message", {
					data: event.data,
				});
				return;
			}

			if (!isSignalMessage(message)) {
				debug("github-signal-stream", "received unknown message type", {
					message,
				});
				return;
			}

			debug("github-signal-stream", "received signal broadcast", {
				keys: message.keys,
			});

			const receivedKeys = new Set(message.keys);
			const currentTargets = targetsRef.current;
			const invalidatedCount = invalidateTargets(
				queryClient,
				currentTargets,
				receivedKeys,
				"github-signal-stream",
			);

			debug("github-signal-stream", "broadcast processed", {
				receivedKeys: message.keys,
				invalidatedCount,
				totalTargets: currentTargets.length,
			});
		}

		function connect() {
			if (disposed) return;

			debug("github-signal-stream", "connecting", {
				url: getWebSocketUrl(),
			});

			ws = new WebSocket(getWebSocketUrl());

			ws.addEventListener("open", () => {
				debug("github-signal-stream", "connected");
				if (ws) sendSubscription(ws);
			});

			ws.addEventListener("message", handleMessage);

			ws.addEventListener("close", (event) => {
				debug("github-signal-stream", "disconnected", {
					code: event.code,
					reason: event.reason,
					wasClean: event.wasClean,
				});
				ws = null;
				scheduleReconnect();
			});

			ws.addEventListener("error", () => {
				debug("github-signal-stream", "connection error");
				ws?.close();
			});
		}

		function scheduleReconnect() {
			if (disposed) return;
			debug("github-signal-stream", "scheduling reconnect", {
				delayMs: RECONNECT_DELAY_MS,
			});
			reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
		}

		connect();

		return () => {
			disposed = true;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}
			if (ws) {
				ws.close();
			}
		};
	}, [signalKeysKey, queryClient]);
}

function useGitHubSignalPoll(
	targets: readonly GitHubSignalStreamTarget[],
	signalKeysKey: string,
) {
	const queryClient = useQueryClient();
	const targetsRef = useRef(targets);
	targetsRef.current = targets;

	useEffect(() => {
		if (signalKeysKey.length === 0) {
			return;
		}

		const keys = signalKeysKey.split(",");
		let pollTimer: ReturnType<typeof setTimeout> | null = null;
		let disposed = false;
		const lastSeenTimestamps = new Map<string, number>();

		async function pollSignals() {
			if (disposed) return;

			try {
				const signals = await getRevalidationSignalTimestamps({
					data: { signalKeys: keys },
				});

				if (disposed) return;

				const updatedKeys: string[] = [];
				for (const signal of signals) {
					const lastSeen = lastSeenTimestamps.get(signal.signalKey);
					if (lastSeen === undefined) {
						lastSeenTimestamps.set(signal.signalKey, signal.updatedAt);
					} else if (signal.updatedAt > lastSeen) {
						lastSeenTimestamps.set(signal.signalKey, signal.updatedAt);
						updatedKeys.push(signal.signalKey);
					}
				}

				if (updatedKeys.length > 0) {
					debug("github-signal-poll", "detected missed signals", {
						updatedKeys,
					});

					const currentTargets = targetsRef.current;
					const invalidatedCount = invalidateTargets(
						queryClient,
						currentTargets,
						new Set(updatedKeys),
						"github-signal-poll",
					);

					debug("github-signal-poll", "poll processed", {
						updatedKeys,
						invalidatedCount,
						totalTargets: currentTargets.length,
					});
				} else {
					debug("github-signal-poll", "no missed signals");
				}
			} catch (error) {
				debug("github-signal-poll", "poll failed", { error });
			}

			schedulePoll();
		}

		function schedulePoll() {
			if (disposed) return;
			pollTimer = setTimeout(pollSignals, POLL_INTERVAL_MS);
		}

		// Seed timestamps immediately, then poll every 5 minutes
		void pollSignals();

		return () => {
			disposed = true;
			if (pollTimer) {
				clearTimeout(pollTimer);
			}
		};
	}, [signalKeysKey, queryClient]);
}

export function useGitHubSignalStream(
	targets: readonly GitHubSignalStreamTarget[],
) {
	const allSignalKeys = useMemo(() => {
		return Array.from(
			new Set(targets.flatMap((target) => [...target.signalKeys])),
		).sort();
	}, [targets]);

	// Stable string so the effects only re-run when the actual keys change,
	// not when the array reference changes.
	const signalKeysKey = allSignalKeys.join(",");

	useGitHubSignalStreamWebSocket(targets, signalKeysKey);
	useGitHubSignalPoll(targets, signalKeysKey);
}
