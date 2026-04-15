import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
	type GitHubQueryScope,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import type { RepoTreeEntry } from "#/lib/github.types";

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 150;

/**
 * Progressively prefetch all directory subtrees in BFS order.
 * Starts from the root entries and walks deeper level by level,
 * fetching BATCH_SIZE directories at a time with a small delay
 * between batches to avoid flooding the network.
 */
export function usePrefetchTree(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string },
	rootEntries: RepoTreeEntry[] | undefined,
) {
	const queryClient = useQueryClient();
	const runIdRef = useRef(0);

	useEffect(() => {
		if (!rootEntries) return;

		const runId = ++runIdRef.current;

		const queue: string[] = [];
		for (const entry of rootEntries) {
			if (entry.type === "dir") {
				queue.push(entry.name);
			}
		}

		let cursor = 0;

		async function processNextBatch() {
			if (runIdRef.current !== runId) return;
			if (cursor >= queue.length) return;

			const batch = queue.slice(cursor, cursor + BATCH_SIZE);
			cursor += batch.length;

			const results = await Promise.all(
				batch.map((path) => {
					const options = githubRepoTreeQueryOptions(scope, {
						...input,
						path,
					});

					// Skip if already cached
					if (queryClient.getQueryData(options.queryKey)) {
						return queryClient.getQueryData(options.queryKey) as
							| RepoTreeEntry[]
							| undefined;
					}

					return queryClient.fetchQuery(options).catch(() => undefined);
				}),
			);

			if (runIdRef.current !== runId) return;

			// Enqueue child directories discovered in this batch
			for (let i = 0; i < batch.length; i++) {
				const parentPath = batch[i];
				const children = results[i];
				if (children) {
					for (const child of children) {
						if (child.type === "dir") {
							queue.push(`${parentPath}/${child.name}`);
						}
					}
				}
			}

			// Schedule next batch
			if (cursor < queue.length) {
				setTimeout(processNextBatch, BATCH_DELAY_MS);
			}
		}

		processNextBatch();

		return () => {
			runIdRef.current++;
		};
	}, [rootEntries, scope, input, queryClient]);
}
