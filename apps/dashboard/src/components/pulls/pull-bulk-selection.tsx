import {
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import {
	type BulkAction,
	BulkChoiceSetting,
	type BulkItemSummary,
	BulkSelection,
} from "#/components/shared/bulk-selection";
import { itemSelectionKey } from "#/components/shared/list-row";
import type { CountNoun } from "#/lib/bulk-actions";
import {
	type MutationResult,
	mergePullRequest,
	updatePullState,
} from "#/lib/github.functions";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	pullEntityKey,
	removePullFromOpenViews,
	repoEntityKey,
} from "#/lib/github-query-updates";
import { getPrStateConfig } from "#/lib/pr-state";
import { useLocalStorageState } from "#/lib/use-local-storage-state";
import { checkPermissionWarning } from "#/lib/warning-store";

const PULL_NOUN: CountNoun = { one: "pull request", other: "pull requests" };

const MERGE_METHODS = [
	{ value: "squash", label: "Squash and merge" },
	{ value: "merge", label: "Create a merge commit" },
	{ value: "rebase", label: "Rebase and merge" },
] as const;

type MergeMethod = (typeof MERGE_METHODS)[number]["value"];

function isMergeMethod(value: unknown): value is MergeMethod {
	return MERGE_METHODS.some((method) => method.value === value);
}

type PullLifecycle = "open" | "draft" | "closed" | "merged";

function pullLifecycle(pull: PullSummary): PullLifecycle {
	if (pull.mergedAt || pull.state === "merged") return "merged";
	if (pull.state === "closed") return "closed";
	return pull.isDraft ? "draft" : "open";
}

const MERGE_SKIP: Record<PullLifecycle, string | null> = {
	open: null,
	draft: "Draft",
	closed: "Closed",
	merged: "Already merged",
};

const CLOSE_SKIP: Record<PullLifecycle, string | null> = {
	open: null,
	draft: null,
	closed: "Already closed",
	merged: "Already merged",
};

const REOPEN_SKIP: Record<PullLifecycle, string | null> = {
	open: "Already open",
	draft: "Already open",
	closed: null,
	merged: "Merged",
};

function pullRef(pull: PullSummary) {
	return {
		owner: pull.repository.owner,
		repo: pull.repository.name,
		pullNumber: pull.number,
	};
}

function describePull(pull: PullSummary): BulkItemSummary {
	const { icon: Icon, color } = getPrStateConfig(pull);
	return {
		icon: <Icon size={14} strokeWidth={2} className={color} />,
		number: pull.number,
		title: pull.title,
		detail: pull.repository.fullName,
	};
}

/** Makes the pull request rows inside it selectable, with merge, close and reopen in bulk. */
export function PullBulkSelection({
	pulls,
	scope,
	children,
}: {
	pulls: readonly PullSummary[];
	scope: GitHubQueryScope;
	children: ReactNode;
}) {
	const queryClient = useQueryClient();
	const [mergeMethod, setMergeMethod] = useLocalStorageState<MergeMethod>(
		"diffkit:pulls:bulk-merge-method",
		{ defaultValue: "squash", validate: isMergeMethod },
	);

	const actions = useMemo<BulkAction<PullSummary>[]>(() => {
		const report = (pull: PullSummary, result: MutationResult) => {
			if (!result.ok) checkPermissionWarning(result, pull.repository.fullName);
			return result;
		};
		const leaveOpenViews = (pull: PullSummary, result: MutationResult) => {
			if (result.ok) removePullFromOpenViews(queryClient, scope, pullRef(pull));
			return report(pull, result);
		};
		const refresh = (succeeded: PullSummary[], withRepos: boolean) => {
			const keys = new Set(
				succeeded.map((pull) => pullEntityKey(pullRef(pull))),
			);
			if (withRepos) {
				for (const pull of succeeded) keys.add(repoEntityKey(pullRef(pull)));
			}
			void invalidateGitHubEntities(queryClient, scope, [...keys]);
		};

		return [
			{
				id: "merge",
				icon: <GitMergeIcon strokeWidth={2} className="text-state-merged" />,
				copy: {
					button: "Merge",
					confirm: (what) => `Merge ${what}`,
					running: "Merging…",
					done: (what) => `Merged ${what}`,
				},
				skipReason: (pull) => MERGE_SKIP[pullLifecycle(pull)],
				run: async (pull) =>
					leaveOpenViews(
						pull,
						await mergePullRequest({
							data: { ...pullRef(pull), mergeMethod },
						}),
					),
				onSettled: (succeeded) => refresh(succeeded, true),
				settings: (
					<BulkChoiceSetting
						label="Merge method"
						options={MERGE_METHODS}
						value={mergeMethod}
						onChange={setMergeMethod}
					/>
				),
			},
			{
				id: "close",
				icon: (
					<GitPullRequestClosedIcon
						strokeWidth={2}
						className="text-state-closed"
					/>
				),
				copy: {
					button: "Close",
					confirm: (what) => `Close ${what}`,
					running: "Closing…",
					done: (what) => `Closed ${what}`,
				},
				skipReason: (pull) => CLOSE_SKIP[pullLifecycle(pull)],
				run: async (pull) =>
					leaveOpenViews(
						pull,
						await updatePullState({
							data: { ...pullRef(pull), state: "closed" },
						}),
					),
				onSettled: (succeeded) => refresh(succeeded, false),
			},
			{
				id: "reopen",
				icon: (
					<GitPullRequestIcon strokeWidth={2} className="text-state-open" />
				),
				copy: {
					button: "Reopen",
					confirm: (what) => `Reopen ${what}`,
					running: "Reopening…",
					done: (what) => `Reopened ${what}`,
				},
				skipReason: (pull) => REOPEN_SKIP[pullLifecycle(pull)],
				run: async (pull) =>
					report(
						pull,
						await updatePullState({
							data: { ...pullRef(pull), state: "open" },
						}),
					),
				onSettled: (succeeded) => refresh(succeeded, false),
			},
		];
	}, [queryClient, scope, mergeMethod, setMergeMethod]);

	return (
		<BulkSelection
			items={pulls}
			getKey={itemSelectionKey}
			noun={PULL_NOUN}
			actions={actions}
			describe={describePull}
		>
			{children}
		</BulkSelection>
	);
}
