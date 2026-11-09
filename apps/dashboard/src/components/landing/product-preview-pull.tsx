import { LineCounts } from "@diffkit/ui/components/detail-layout";
import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import { useMemo } from "react";
import { DetailPageLayout } from "#/components/details/detail-page";
import {
	PullDetailTitle,
	PullReviewRequest,
} from "#/components/pulls/detail/pull-detail-header";
import { PullDetailBody } from "#/components/pulls/detail/pull-detail-page";
import { PullDetailSidebar } from "#/components/pulls/detail/pull-detail-sidebar";
import { githubQueryKeys } from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { previewPullPage } from "./product-preview-pull-samples";
import {
	PREVIEW_VIEWER,
	PREVIEW_VIEWER_LOGIN,
} from "./product-preview-samples";

const SCOPE = { userId: PREVIEW_VIEWER.id };

/**
 * A sample pull request on the real detail components. It is inert: every
 * control on this page writes to GitHub, which a preview has no account for.
 */
export default function ProductPreviewPull({
	pull,
	reviewRequested,
}: {
	pull: PullSummary;
	reviewRequested: boolean;
}) {
	const { detail, page } = useMemo(
		() => previewPullPage(pull, reviewRequested, Date.now()),
		[pull, reviewRequested],
	);
	const { owner, name: repo } = pull.repository;
	const pullNumber = pull.number;

	return (
		<div inert className="h-full">
			<DetailPageLayout
				tabs={
					<ViewTabs label="Pull request views">
						<ViewTab active>Overview</ViewTab>
						<ViewTab>
							Files changed
							<ViewTabCount>{detail.changedFiles}</ViewTabCount>
							<LineCounts
								additions={detail.additions}
								deletions={detail.deletions}
								className="ml-1.5 text-xs max-md:hidden"
							/>
						</ViewTab>
					</ViewTabs>
				}
				main={
					<>
						<div className="flex flex-col gap-8">
							<PullDetailTitle owner={owner} repo={repo} pr={detail} />
							<PullReviewRequest
								owner={owner}
								repo={repo}
								pullId={String(pullNumber)}
								pr={detail}
								viewerLogin={PREVIEW_VIEWER_LOGIN}
							/>
						</div>
						<PullDetailBody
							owner={owner}
							repo={repo}
							pullNumber={pullNumber}
							scope={SCOPE}
							pageQueryKey={githubQueryKeys.pulls.page(SCOPE, {
								owner,
								repo,
								pullNumber,
							})}
							viewerLogin={PREVIEW_VIEWER_LOGIN}
							pr={detail}
							page={page}
							isFetching={false}
						/>
					</>
				}
				sidebar={
					<PullDetailSidebar
						pr={detail}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						scope={SCOPE}
					/>
				}
			/>
		</div>
	);
}
