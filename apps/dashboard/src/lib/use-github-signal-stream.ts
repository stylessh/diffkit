import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import { debug } from "./debug";
import { getRevalidationSignalTimestamps } from "./github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "./github.query";
import { githubRevalidationSignalKeys } from "./github-revalidation";

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
/**
 * Safety net for missed WebSocket broadcasts. Tight enough that a dropped
 * signal surfaces within ~20 s; the work itself is one indexed lookup keyed
 * by the (small) set of signal keys the page subscribes to.
 */
const POLL_INTERVAL_MS = 20 * 1_000;
const RESUME_SYNC_MIN_INTERVAL_MS = 2_000;

export function getGitHubDataFetchedAt(value: unknown): number | null {
	if (!value || typeof value !== "object" || !("__meta" in value)) {
		return null;
	}

	const meta = value.__meta;
	if (!meta || typeof meta !== "object" || !("fetchedAt" in meta)) {
		return null;
	}

	return typeof meta.fetchedAt === "number" ? meta.fetchedAt : null;
}

export function getGitHubSignalComparisonTimestamp(
	queryState:
		| {
				data?: unknown;
				dataUpdatedAt: number;
		  }
		| null
		| undefined,
) {
	if (!queryState || queryState.dataUpdatedAt === 0) {
		return null;
	}

	return (
		getGitHubDataFetchedAt(queryState.data) ??
		(queryState.dataUpdatedAt > 0 ? queryState.dataUpdatedAt : null)
	);
}

function tryGitHubQueryScopeFromTargets(
	targets: readonly GitHubSignalStreamTarget[],
): GitHubQueryScope | null {
	for (const target of targets) {
		const key = target.queryKey;
		if (
			Array.isArray(key) &&
			key.length >= 2 &&
			key[0] === "github" &&
			typeof key[1] === "string"
		) {
			return { userId: key[1] };
		}
	}
	return null;
}

/** Ensures MyPulls, MyIssues, and MyReviews (same query as MyPulls) stay subscribed and invalidatable on every tab. */
function mergeTargetsWithMyGitHubLists(
	targets: readonly GitHubSignalStreamTarget[],
): GitHubSignalStreamTarget[] {
	const scope = tryGitHubQueryScopeFromTargets(targets);
	if (!scope) {
		return [...targets];
	}

	const extras: GitHubSignalStreamTarget[] = [
		{
			queryKey: githubQueryKeys.pulls.mine(scope),
			signalKeys: [githubRevalidationSignalKeys.pullsMine],
		},
		{
			queryKey: githubQueryKeys.issues.mine(scope),
			signalKeys: [githubRevalidationSignalKeys.issuesMine],
		},
	];

	const seen = new Set<string>();
	const out: GitHubSignalStreamTarget[] = [];

	for (const target of [...targets, ...extras]) {
		const sig = `${JSON.stringify(target.queryKey)}\0${[...target.signalKeys].sort().join(",")}`;
		if (seen.has(sig)) continue;
		seen.add(sig);
		out.push(target);
	}

	return out;
}

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

function signalStreamCompositeKey(
	queryKey: QueryKey,
	signalKey: string,
): string {
	return `${JSON.stringify(queryKey)}\0${signalKey}`;
}

/** Sync server signal timestamps with local query ages; mutates lastSeenTimestamps (per queryKey+signalKey). */
function collectKeysToInvalidateAfterServerSync(
	queryClient: ReturnType<typeof useQueryClient>,
	targets: readonly GitHubSignalStreamTarget[],
	signals: Array<{ signalKey: string; updatedAt: number }>,
	lastSeenTimestamps: Map<string, number>,
): string[] {
	const updatedKeys = new Set<string>();

	for (const signal of signals) {
		for (const target of targets) {
			if (!target.signalKeys.includes(signal.signalKey)) {
				continue;
			}

			const compositeKey = signalStreamCompositeKey(
				target.queryKey,
				signal.signalKey,
			);
			const lastSeen = lastSeenTimestamps.get(compositeKey);
			const freshnessTimestamp = getGitHubSignalComparisonTimestamp(
				queryClient.getQueryState(target.queryKey),
			);

			if (lastSeen === undefined) {
				if (typeof freshnessTimestamp !== "number") {
					// Query is still loading — defer recording until we can compare
					// against the cached payload's fetchedAt. Otherwise a webhook that
					// fired before mount would be silently absorbed and never invalidate.
					continue;
				}
				if (signal.updatedAt > freshnessTimestamp) {
					updatedKeys.add(signal.signalKey);
				}
				lastSeenTimestamps.set(compositeKey, signal.updatedAt);
			} else if (signal.updatedAt > lastSeen) {
				lastSeenTimestamps.set(compositeKey, signal.updatedAt);
				updatedKeys.add(signal.signalKey);
			}
		}
	}

	return Array.from(updatedKeys);
}

function useGitHubSignalStreamWebSocket(
	targets: readonly GitHubSignalStreamTarget[],
	signalKeysKey: string,
	lastSeenTimestampsRef: MutableRefObject<Map<string, number>>,
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
		let lastResumeSyncAt = 0;

		async function syncSignalsFromServer(source: string) {
			try {
				debug(source, "attempting catch-up", {
					signalKeys: keys,
					totalTargets: targetsRef.current.length,
				});

				const signals = await getRevalidationSignalTimestamps({
					data: { signalKeys: keys },
				});
				if (disposed) return;

				const updatedKeys = collectKeysToInvalidateAfterServerSync(
					queryClient,
					targetsRef.current,
					signals,
					lastSeenTimestampsRef.current,
				);

				if (updatedKeys.length === 0) {
					return;
				}

				debug(source, "detected missed or stale cache vs signals", {
					updatedKeys,
				});

				const invalidatedCount = invalidateTargets(
					queryClient,
					targetsRef.current,
					new Set(updatedKeys),
					source,
				);

				debug(source, "sync processed", {
					updatedKeys,
					invalidatedCount,
					totalTargets: targetsRef.current.length,
				});
			} catch (error) {
				debug(source, "sync failed", { error });
			}
		}

		function scheduleResumeSync(source: string) {
			const now = Date.now();
			if (now - lastResumeSyncAt < RESUME_SYNC_MIN_INTERVAL_MS) {
				debug(source, "skipping catch-up attempt", {
					reason: "throttled",
					signalKeys: keys,
					lastResumeSyncAt,
					now,
				});
				return;
			}

			lastResumeSyncAt = now;
			debug(source, "scheduling catch-up attempt", {
				signalKeys: keys,
				totalTargets: targetsRef.current.length,
			});
			void syncSignalsFromServer(source);
		}

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
				void syncSignalsFromServer("github-signal-ws-catchup");
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

		function handleVisibilityChange() {
			if (document.visibilityState === "visible") {
				scheduleResumeSync("github-signal-visibility-catchup");
			}
		}

		function handleWindowFocus() {
			scheduleResumeSync("github-signal-focus-catchup");
		}

		function handleOnline() {
			scheduleResumeSync("github-signal-online-catchup");
		}

		connect();
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("focus", handleWindowFocus);
		window.addEventListener("online", handleOnline);

		return () => {
			disposed = true;
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("focus", handleWindowFocus);
			window.removeEventListener("online", handleOnline);
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}
			if (ws) {
				ws.close();
			}
		};
	}, [signalKeysKey, queryClient, lastSeenTimestampsRef]);
}

function useGitHubSignalPoll(
	targets: readonly GitHubSignalStreamTarget[],
	signalKeysKey: string,
	lastSeenTimestampsRef: MutableRefObject<Map<string, number>>,
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

		async function pollSignals() {
			if (disposed) return;

			try {
				const signals = await getRevalidationSignalTimestamps({
					data: { signalKeys: keys },
				});

				if (disposed) return;

				const updatedKeys = collectKeysToInvalidateAfterServerSync(
					queryClient,
					targetsRef.current,
					signals,
					lastSeenTimestampsRef.current,
				);

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

		// Seed timestamps immediately, then poll on POLL_INTERVAL_MS
		void pollSignals();

		return () => {
			disposed = true;
			if (pollTimer) {
				clearTimeout(pollTimer);
			}
		};
	}, [signalKeysKey, queryClient, lastSeenTimestampsRef]);
}

export function useGitHubSignalStream(
	targets: readonly GitHubSignalStreamTarget[],
) {
	const mergedTargets = useMemo(
		() => mergeTargetsWithMyGitHubLists(targets),
		[targets],
	);

	const allSignalKeys = useMemo(() => {
		return Array.from(
			new Set(mergedTargets.flatMap((target) => [...target.signalKeys])),
		).sort();
	}, [mergedTargets]);

	// Stable string so the effects only re-run when the actual keys change,
	// not when the array reference changes.
	const signalKeysKey = allSignalKeys.join(",");

	const mergedTargetsIdentity = useMemo(
		() =>
			mergedTargets
				.map(
					(t) =>
						`${JSON.stringify(t.queryKey)}\0${[...t.signalKeys].sort().join(",")}`,
				)
				.sort()
				.join("|"),
		[mergedTargets],
	);

	const lastSeenTimestampsRef = useRef(new Map<string, number>());

	useEffect(() => {
		// Reference deps so the reset runs when subscription identity changes (Biome exhaustive-deps).
		void signalKeysKey;
		void mergedTargetsIdentity;
		lastSeenTimestampsRef.current = new Map();
	}, [signalKeysKey, mergedTargetsIdentity]);

	useGitHubSignalStreamWebSocket(
		mergedTargets,
		signalKeysKey,
		lastSeenTimestampsRef,
	);
	useGitHubSignalPoll(mergedTargets, signalKeysKey, lastSeenTimestampsRef);
}
