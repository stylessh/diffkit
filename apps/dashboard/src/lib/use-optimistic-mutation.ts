import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

type OptimisticUpdate = {
	queryKey: readonly unknown[];
	// biome-ignore lint/suspicious/noExplicitAny: updater must accept any cached data shape
	updater: (current: any) => any;
};

type MutateOptions<TResult> = {
	mutationFn: () => Promise<TResult>;
	updates: OptimisticUpdate[];
	/** Defaults to `Boolean(result)`. */
	isSuccess?: (result: TResult) => boolean;
};

/**
 * Nothing is refetched on success: GitHub can serve the pre-write state for a
 * moment, so an immediate refetch would flash the old value. The change feed
 * (or focus refetch for repos without the app) reconciles later.
 */
export function useOptimisticMutation() {
	const queryClient = useQueryClient();

	const mutate = useCallback(
		async <TResult>(
			options: MutateOptions<TResult>,
		): Promise<TResult | undefined> => {
			const {
				mutationFn,
				updates,
				isSuccess = (result: TResult) => Boolean(result),
			} = options;

			const snapshots = updates.map((u) => ({
				queryKey: u.queryKey,
				data: queryClient.getQueryData(u.queryKey),
			}));

			for (const update of updates) {
				queryClient.setQueryData(update.queryKey, (current: unknown) => {
					if (current === undefined) return current;
					return update.updater(current);
				});
			}

			try {
				const result = await mutationFn();

				if (isSuccess(result)) {
					return result;
				}

				for (const snapshot of snapshots) {
					queryClient.setQueryData(snapshot.queryKey, snapshot.data);
				}
				return result;
			} catch {
				for (const snapshot of snapshots) {
					queryClient.setQueryData(snapshot.queryKey, snapshot.data);
				}
				return undefined;
			}
		},
		[queryClient],
	);

	return { mutate };
}
