import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

type OptimisticUpdate = {
	queryKey: readonly unknown[];
	// biome-ignore lint/suspicious/noExplicitAny: updater must accept any cached data shape
	updater: (current: any) => any;
};

type MutateOptions<TResult> = {
	/** The server function call, e.g. () => removeReviewRequest({ data: ... }) */
	mutationFn: () => Promise<TResult>;
	/** One or more optimistic cache updates to apply before the server call */
	updates?: OptimisticUpdate[];
	/**
	 * Query key prefix to invalidate on success.
	 * Defaults to ["github"].
	 */
	invalidateQueryKey?: readonly unknown[];
	/**
	 * Custom success check. Defaults to Boolean(result).
	 */
	isSuccess?: (result: TResult) => boolean;
};

export function useOptimisticMutation() {
	const queryClient = useQueryClient();

	const mutate = useCallback(
		async <TResult>(
			options: MutateOptions<TResult>,
		): Promise<TResult | undefined> => {
			const {
				mutationFn,
				updates = [],
				invalidateQueryKey = ["github"],
				isSuccess = (result: TResult) => Boolean(result),
			} = options;

			const hasOptimisticUpdates = updates.length > 0;

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
					// Skip immediate invalidation when optimistic updates were applied.
					// The optimistic cache already reflects the expected state, and an
					// immediate refetch can return stale data from GitHub before the
					// write has propagated — causing a flash. Webhook-driven revalidation
					// will bring in the canonical data once GitHub has processed the event.
					if (!hasOptimisticUpdates) {
						await queryClient.invalidateQueries({
							queryKey: invalidateQueryKey,
						});
					}
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
