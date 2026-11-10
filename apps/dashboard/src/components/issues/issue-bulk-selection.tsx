import {
	IssueClosedCompletedIcon,
	IssueClosedNotPlannedIcon,
	IssuesIcon,
} from "@diffkit/icons";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import {
	type BulkAction,
	BulkChoiceSetting,
	type BulkItemSummary,
	BulkSelection,
} from "#/components/shared/bulk-selection";
import { itemSelectionKey } from "#/components/shared/list-row";
import type { CountNoun } from "#/lib/bulk-actions";
import { type MutationResult, updateIssueState } from "#/lib/github.functions";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { IssueSummary } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	issueEntityKey,
	removeIssueFromOpenViews,
} from "#/lib/github-query-updates";
import { checkPermissionWarning } from "#/lib/warning-store";
import { issueStateColor } from "./issue-row";

const ISSUE_NOUN: CountNoun = { one: "issue", other: "issues" };

const CLOSE_REASONS = [
	{ value: "completed", label: "Completed" },
	{ value: "not_planned", label: "Not planned" },
] as const;

type CloseReason = (typeof CLOSE_REASONS)[number]["value"];

function issueRef(issue: IssueSummary) {
	return {
		owner: issue.repository.owner,
		repo: issue.repository.name,
		issueNumber: issue.number,
	};
}

function describeIssue(issue: IssueSummary): BulkItemSummary {
	const Icon =
		issue.state !== "closed"
			? IssuesIcon
			: issue.stateReason === "not_planned"
				? IssueClosedNotPlannedIcon
				: IssueClosedCompletedIcon;
	return {
		icon: <Icon size={14} strokeWidth={2} className={issueStateColor(issue)} />,
		number: issue.number,
		title: issue.title,
		detail: issue.repository.fullName,
	};
}

/** Makes the issue rows inside it selectable, with close and reopen in bulk. */
export function IssueBulkSelection({
	issues,
	scope,
	children,
}: {
	issues: readonly IssueSummary[];
	scope: GitHubQueryScope;
	children: ReactNode;
}) {
	const queryClient = useQueryClient();
	const [closeReason, setCloseReason] = useState<CloseReason>("completed");

	const actions = useMemo<BulkAction<IssueSummary>[]>(() => {
		const report = (issue: IssueSummary, result: MutationResult) => {
			if (!result.ok) checkPermissionWarning(result, issue.repository.fullName);
			return result;
		};
		const refresh = (succeeded: IssueSummary[]) => {
			void invalidateGitHubEntities(
				queryClient,
				scope,
				succeeded.map((issue) => issueEntityKey(issueRef(issue))),
			);
		};

		return [
			{
				id: "close",
				icon: (
					<IssueClosedCompletedIcon
						strokeWidth={2}
						className="text-state-merged"
					/>
				),
				copy: {
					button: "Close",
					confirm: (what) => `Close ${what}`,
					running: "Closing…",
					done: (what) => `Closed ${what}`,
				},
				skipReason: (issue) =>
					issue.state === "closed" ? "Already closed" : null,
				run: async (issue) => {
					const result = await updateIssueState({
						data: { ...issueRef(issue), state: "closed", closeReason },
					});
					if (result.ok) {
						removeIssueFromOpenViews(queryClient, scope, issueRef(issue));
					}
					return report(issue, result);
				},
				onSettled: refresh,
				settings: (
					<BulkChoiceSetting
						label="Close as"
						options={CLOSE_REASONS}
						value={closeReason}
						onChange={setCloseReason}
					/>
				),
			},
			{
				id: "reopen",
				icon: <IssuesIcon strokeWidth={2} className="text-state-open" />,
				copy: {
					button: "Reopen",
					confirm: (what) => `Reopen ${what}`,
					running: "Reopening…",
					done: (what) => `Reopened ${what}`,
				},
				skipReason: (issue) =>
					issue.state === "closed" ? null : "Already open",
				run: async (issue) =>
					report(
						issue,
						await updateIssueState({
							data: { ...issueRef(issue), state: "open" },
						}),
					),
				onSettled: refresh,
			},
		];
	}, [queryClient, scope, closeReason]);

	return (
		<BulkSelection
			items={issues}
			getKey={itemSelectionKey}
			noun={ISSUE_NOUN}
			actions={actions}
			describe={describeIssue}
		>
			{children}
		</BulkSelection>
	);
}
