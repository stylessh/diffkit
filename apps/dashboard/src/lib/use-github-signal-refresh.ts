import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { debug } from "./debug";
import { getGitHubRevalidationSignalRecords } from "./github.functions";

export type GitHubSignalRefreshTarget = {
	queryKey: QueryKey;
	signalKeys: readonly string[];
};

export function useGitHubSignalRefresh({
	enabled,
	targets,
}: {
	enabled: boolean;
	targets: readonly GitHubSignalRefreshTarget[];
}) {
	const queryClient = useQueryClient();
	const checkedSignatureRef = useRef<string | null>(null);
	const signature = useMemo(
		() =>
			JSON.stringify(
				targets.map((target) => ({
					queryKey: target.queryKey,
					signalKeys: Array.from(new Set(target.signalKeys)).sort(),
				})),
			),
		[targets],
	);

	useEffect(() => {
		if (!enabled || targets.length === 0) {
			return;
		}

		if (checkedSignatureRef.current === signature) {
			return;
		}

		const signalKeys = Array.from(
			new Set(targets.flatMap((target) => target.signalKeys)),
		);
		if (signalKeys.length === 0) {
			return;
		}

		checkedSignatureRef.current = signature;
		let cancelled = false;

		void (async () => {
			const records = await getGitHubRevalidationSignalRecords({
				data: { signalKeys },
			});
			if (cancelled) {
				return;
			}

			const updatedAtBySignalKey = new Map(
				records.map((record) => [record.signalKey, record.updatedAt]),
			);

			await Promise.all(
				targets.map(async (target) => {
					const queryState = queryClient.getQueryState(target.queryKey);
					const queryUpdatedAt = queryState?.dataUpdatedAt ?? 0;
					if (queryUpdatedAt === 0 || queryState?.fetchStatus === "fetching") {
						return;
					}

					const signalUpdatedAt = target.signalKeys.reduce(
						(latest, signalKey) =>
							Math.max(latest, updatedAtBySignalKey.get(signalKey) ?? 0),
						0,
					);

					if (signalUpdatedAt <= queryUpdatedAt) {
						return;
					}

					debug("github-revalidation", "refreshing query after webhook", {
						queryKey: target.queryKey,
						queryUpdatedAt,
						signalUpdatedAt,
					});

					await queryClient.invalidateQueries({
						queryKey: target.queryKey,
						exact: true,
						refetchType: "active",
					});
				}),
			);
		})().catch((error: unknown) => {
			debug("github-revalidation", "webhook signal check failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		});

		return () => {
			cancelled = true;
		};
	}, [enabled, queryClient, signature, targets]);
}
