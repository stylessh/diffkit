import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Skeleton } from "skullet/react";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import {
	type GitHubQueryScope,
	githubPullStatusQueryOptions,
} from "#/lib/github.query";
import type { PullStatus } from "#/lib/github.types";
import { SAMPLE_PULL_STATUS } from "../pull-detail-samples";
import { ChecksSection } from "./checks-section";
import { ConflictsSection } from "./conflicts-section";
import { MergeFooter } from "./merge-footer";
import { ReadyForReviewFooter } from "./ready-for-review-footer";
import { ReviewsSection } from "./reviews-section";
import { StatusRow } from "./status-row";
import { UpdateBranchButton } from "./update-branch-button";
import { useMergeBypass } from "./use-merge-bypass";

type MergeBoxProps = {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	pullNumber: number;
	prTitle: string;
	firstCommitMessage?: string;
	isDraft: boolean;
	pullId: string | undefined;
	/** The stack's own merge row, shown first. */
	stack: React.ReactNode;
};

/** The merge box of an open pull request: reviews, checks, branch state and the merge action. */
export function MergeStatusSection(props: MergeBoxProps) {
	const { scope, owner, repo, pullNumber } = props;
	const input = useMemo(
		() => ({ owner, repo, pullNumber }),
		[owner, repo, pullNumber],
	);
	const isSample = useIsSkeletonSample();
	const statusQuery = useQuery({
		...githubPullStatusQueryOptions(scope, input),
		enabled: !isSample,
	});

	return (
		<Skeleton
			data={isSample ? SAMPLE_PULL_STATUS : statusQuery.data}
			sample={SAMPLE_PULL_STATUS}
			label="Loading merge status"
		>
			{(status) => <MergeStatusCard {...props} status={status} />}
		</Skeleton>
	);
}

function MergeStatusCard({
	stack,
	scope,
	status,
	owner,
	repo,
	pullNumber,
	prTitle,
	firstCommitMessage,
	isDraft,
	pullId,
}: MergeBoxProps & { status: PullStatus }) {
	const { checks, pendingWorkflowApprovals, mergeableState, behindBy } = status;
	const hasConflicts = mergeableState === "dirty";
	const isMergeBlocked =
		mergeableState === "blocked" || status.mergeable === false;

	const bypass = useMergeBypass({
		isMergeBlocked,
		canBypassProtections: status.canBypassProtections,
		hasConflicts,
	});

	const pull = { owner, repo, pullNumber };

	return (
		<div className="-mx-[8.5px] flex flex-col overflow-hidden rounded-lg border-[0.5px] border-border bg-card shadow-[var(--ln-main-shadow)]">
			{stack}

			<ReviewsSection reviews={status.reviews} {...pull} />

			{(checks.total > 0 || pendingWorkflowApprovals.length > 0) && (
				<ChecksSection
					scope={scope}
					checks={checks}
					checkRuns={status.checkRuns}
					pendingWorkflowApprovals={pendingWorkflowApprovals}
					{...pull}
				/>
			)}

			{hasConflicts ? (
				<ConflictsSection conflictingFiles={status.conflictingFiles ?? []} />
			) : behindBy !== null && behindBy > 0 ? (
				<StatusRow
					status="pending"
					title="This branch is out-of-date with the base branch"
					description={`Merge the latest changes from ${status.baseRefName} into this branch.`}
					action={
						status.canUpdateBranch ? (
							<UpdateBranchButton {...pull} />
						) : undefined
					}
				/>
			) : (
				<StatusRow
					status="success"
					title="No conflicts with base branch"
					description="Merging can be performed automatically."
				/>
			)}

			{isDraft ? (
				<ReadyForReviewFooter {...pull} pullId={pullId} />
			) : (
				<MergeFooter
					scope={scope}
					isMergeBlocked={isMergeBlocked}
					canMerge={status.canMerge}
					bypass={bypass}
					prTitle={prTitle}
					firstCommitMessage={firstCommitMessage}
					{...pull}
				/>
			)}
		</div>
	);
}
