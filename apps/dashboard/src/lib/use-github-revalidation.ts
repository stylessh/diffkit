import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { debug } from "./debug";
import { getGitHubRevalidationSignalRecords } from "./github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "./github.query";
import {
	getGitHubRevalidationSignalKeysForTab,
	githubRevalidationSignalKeys,
} from "./github-revalidation";
import { type Tab, useTabs } from "./tab-store";

const GITHUB_REVALIDATION_POLL_INTERVAL_MS = 10_000;
const GITHUB_REVALIDATION_INITIAL_DELAY_MS = 5_000;

function getUniqueSignalKeys(tabs: Tab[]) {
	return Array.from(
		new Set([
			githubRevalidationSignalKeys.pullsMine,
			githubRevalidationSignalKeys.issuesMine,
			...tabs.flatMap((tab) => getGitHubRevalidationSignalKeysForTab(tab)),
		]),
	);
}

function getQueryUpdatedAt(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
) {
	return queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
}

async function invalidatePullTabQueries(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	tab: Tab,
) {
	const [owner, repo] = tab.repo.split("/");
	const input = { owner, repo, pullNumber: tab.number };
	const queryKeys = [
		githubQueryKeys.pulls.page(scope, input),
		githubQueryKeys.pulls.detail(scope, input),
		githubQueryKeys.pulls.fileSummaries(scope, input),
		githubQueryKeys.pulls.comments(scope, input),
		githubQueryKeys.pulls.status(scope, input),
		githubQueryKeys.pulls.files(scope, input),
		githubQueryKeys.pulls.reviewComments(scope, input),
	];

	const hasOlderQuery = queryKeys.some(
		(queryKey) => getQueryUpdatedAt(queryClient, queryKey) > 0,
	);
	if (!hasOlderQuery) {
		return;
	}

	await Promise.all(
		queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
	);
}

async function invalidateIssueTabQueries(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	tab: Tab,
) {
	const [owner, repo] = tab.repo.split("/");
	const input = { owner, repo, issueNumber: tab.number };
	const queryKeys = [
		githubQueryKeys.issues.page(scope, input),
		githubQueryKeys.issues.detail(scope, input),
		githubQueryKeys.issues.comments(scope, input),
	];

	const hasOlderQuery = queryKeys.some(
		(queryKey) => getQueryUpdatedAt(queryClient, queryKey) > 0,
	);
	if (!hasOlderQuery) {
		return;
	}

	await Promise.all(
		queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
	);
}

export function useGitHubRevalidation(userId: string) {
	const queryClient = useQueryClient();
	const tabs = useTabs();
	const scope = useMemo<GitHubQueryScope>(() => ({ userId }), [userId]);
	const signalKeys = useMemo(() => getUniqueSignalKeys(tabs), [tabs]);

	useEffect(() => {
		let cancelled = false;
		let timeoutId: number | undefined;

		const pollSignals = async () => {
			try {
				const records = await getGitHubRevalidationSignalRecords({
					data: { signalKeys },
				});
				if (cancelled) {
					return;
				}

				const signalsByKey = new Map(
					records.map((record) => [record.signalKey, record.updatedAt]),
				);

				// Invalidate list queries first (lightweight)
				const pullsMineUpdatedAt =
					signalsByKey.get(githubRevalidationSignalKeys.pullsMine) ?? 0;
				if (
					pullsMineUpdatedAt >
					getQueryUpdatedAt(queryClient, githubQueryKeys.pulls.mine(scope))
				) {
					debug("github-revalidation", "invalidating pull list queries", {
						pullsMineUpdatedAt,
					});
					await queryClient.invalidateQueries({
						queryKey: githubQueryKeys.pulls.mine(scope),
					});
				}

				const issuesMineUpdatedAt =
					signalsByKey.get(githubRevalidationSignalKeys.issuesMine) ?? 0;
				if (
					issuesMineUpdatedAt >
					getQueryUpdatedAt(queryClient, githubQueryKeys.issues.mine(scope))
				) {
					debug("github-revalidation", "invalidating issue list queries", {
						issuesMineUpdatedAt,
					});
					await queryClient.invalidateQueries({
						queryKey: githubQueryKeys.issues.mine(scope),
					});
				}

				// Invalidate tab queries serially to avoid a burst of concurrent
				// server function RPCs that can overwhelm the Worker.
				for (const tab of tabs) {
					if (cancelled) break;

					const signalKey = getGitHubRevalidationSignalKeysForTab(tab)[0];
					const updatedAt = signalsByKey.get(signalKey) ?? 0;
					if (updatedAt === 0) {
						continue;
					}

					if (tab.type === "pull" || tab.type === "review") {
						const [owner, repo] = tab.repo.split("/");
						const comparisonKey = githubQueryKeys.pulls.page(scope, {
							owner,
							repo,
							pullNumber: tab.number,
						});
						if (updatedAt > getQueryUpdatedAt(queryClient, comparisonKey)) {
							debug("github-revalidation", "invalidating pull tab queries", {
								signalKey,
								tabId: tab.id,
							});
							await invalidatePullTabQueries(queryClient, scope, tab);
						}
						continue;
					}

					const [owner, repo] = tab.repo.split("/");
					const comparisonKey = githubQueryKeys.issues.page(scope, {
						owner,
						repo,
						issueNumber: tab.number,
					});
					if (updatedAt > getQueryUpdatedAt(queryClient, comparisonKey)) {
						debug("github-revalidation", "invalidating issue tab queries", {
							signalKey,
							tabId: tab.id,
						});
						await invalidateIssueTabQueries(queryClient, scope, tab);
					}
				}
			} catch (error) {
				debug("github-revalidation", "poll failed", {
					error: error instanceof Error ? error.message : String(error),
				});
			} finally {
				if (!cancelled) {
					timeoutId = window.setTimeout(
						pollSignals,
						GITHUB_REVALIDATION_POLL_INTERVAL_MS,
					);
				}
			}
		};

		// Delay the first poll so it doesn't collide with initial data loading
		// (route loaders + preloading) which already makes server function RPCs.
		timeoutId = window.setTimeout(
			pollSignals,
			GITHUB_REVALIDATION_INITIAL_DELAY_MS,
		);

		return () => {
			cancelled = true;
			if (typeof timeoutId !== "undefined") {
				window.clearTimeout(timeoutId);
			}
		};
	}, [queryClient, scope, signalKeys, tabs]);
}
