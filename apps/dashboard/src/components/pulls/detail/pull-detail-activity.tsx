import { useMemo } from "react";
import {
	DetailActivityHeader,
	DetailCommentBox,
} from "#/components/details/detail-activity";
import { getInvolvedUsers } from "#/components/details/timeline/involved-users";
import { PullStackMergeSection } from "#/components/pulls/stack/pull-stack-section";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import type { GitHubQueryScope } from "#/lib/github.query";
import type {
	PullDetail,
	PullPageData,
	PullReviewComment,
} from "#/lib/github.types";
import { MergeStatusSection } from "./merge-box/merge-status-section";
import { MergedBranchBanner } from "./merge-box/merged-branch-banner";
import type { ReviewThreadInfo } from "./review-comments/review-comment-thread";
import { PullTimeline } from "./timeline/pull-timeline";

export function PullDetailActivitySection({
	pr,
	page,
	reviewComments,
	threadInfoByCommentId,
	pageQueryKey,
	owner,
	repo,
	pullNumber,
	scope,
	viewerLogin,
}: {
	pr: PullDetail;
	page: PullPageData;
	reviewComments?: PullReviewComment[];
	threadInfoByCommentId?: ReadonlyMap<number, ReviewThreadInfo>;
	pageQueryKey: readonly unknown[];
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
	viewerLogin?: string;
}) {
	const isSample = useIsSkeletonSample();
	const { comments, commits, events } = page;
	const activityCount = comments.length + commits.length + events.length;
	const isOpen = !pr.isMerged && pr.state !== "closed";

	const involvedUsers = useMemo(
		() => getInvolvedUsers([pr.author, ...pr.requestedReviewers], comments),
		[pr.author, pr.requestedReviewers, comments],
	);

	return (
		<div className="flex flex-col">
			<DetailActivityHeader title="Activity" count={activityCount} />

			{activityCount === 0 && (
				<p className="py-4 text-sm text-muted-foreground">No activity yet.</p>
			)}

			<PullTimeline
				pr={pr}
				page={page}
				reviewComments={reviewComments}
				threadInfoByCommentId={threadInfoByCommentId}
				pageQueryKey={pageQueryKey}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
				scope={scope}
				viewerLogin={viewerLogin}
			/>

			{isOpen && (
				<div className="mt-6">
					<MergeStatusSection
						stack={
							isSample ? null : (
								<PullStackMergeSection
									pr={pr}
									owner={owner}
									repo={repo}
									scope={scope}
								/>
							)
						}
						scope={scope}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						prTitle={pr.title}
						firstCommitMessage={commits[0]?.message}
						isDraft={pr.isDraft}
						pullId={pr.graphqlId}
					/>
				</div>
			)}

			{pr.isMerged && (
				<div className="mt-6">
					<MergedBranchBanner
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						branchName={pr.headRefName}
						headRefDeleted={page.headRefDeleted}
					/>
				</div>
			)}

			<div className="mt-6">
				<DetailCommentBox
					owner={owner}
					repo={repo}
					issueNumber={pullNumber}
					scope={scope}
					involvedUsers={involvedUsers}
					stateToggle={
						!pr.isMerged && (pr.state === "open" || pr.state === "closed")
							? { kind: "pull", state: pr.state }
							: undefined
					}
				/>
			</div>
		</div>
	);
}
