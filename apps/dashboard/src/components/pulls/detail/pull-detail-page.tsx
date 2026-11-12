import { LineCounts } from "@diffkit/ui/components/detail-layout";
import { StatePill } from "@diffkit/ui/components/state-pill";
import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Skeleton, SkeletonBox } from "skullet/react";
import {
	DetailPageLayout,
	DetailPageTitle,
} from "#/components/details/detail-page";
import { PullStackSection } from "#/components/pulls/stack/pull-stack-section";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import {
	type GitHubQueryScope,
	githubPullPageQueryOptions,
	githubPullReviewCommentsQueryOptions,
	githubQueryKeys,
	githubReviewThreadStatusesQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type {
	PullDetail,
	PullPageData,
	PullReviewComment,
	PullSummary,
} from "#/lib/github.types";
import { findPullSummaryInLists } from "#/lib/github-query-updates";
import { useHasMounted } from "#/lib/use-has-mounted";
import { usePageTitle } from "#/lib/use-page-title";
import { useRegisterTab } from "#/lib/use-register-tab";
import { PullBodySection } from "./pull-body-section";
import { PullDetailActivitySection } from "./pull-detail-activity";
import {
	getPrStateConfig,
	PullDetailTitle,
	PullReviewRequest,
} from "./pull-detail-header";
import { SAMPLE_PULL, SAMPLE_PULL_PAGE } from "./pull-detail-samples";
import { PullDetailSidebar } from "./pull-detail-sidebar";
import type { ReviewThreadInfo } from "./review-comments/review-comment-thread";

const routeApi = getRouteApi("/_protected/$owner/$repo/pull/$pullId");

export function PullDetailPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, pullId } = routeApi.useParams();

	return (
		<PullDetailContent
			owner={owner}
			repo={repo}
			pullNumber={Number(pullId)}
			userId={user.id}
			registerTab
		/>
	);
}

export type PullDetailContentProps = {
	owner: string;
	repo: string;
	pullNumber: number;
	userId: string;
	registerTab?: boolean;
};

export function PullDetailContent({
	owner,
	repo,
	pullNumber,
	userId,
	registerTab = false,
}: PullDetailContentProps) {
	const scope = useMemo(() => ({ userId }), [userId]);
	const input = useMemo(
		() => ({ owner, repo, pullNumber }),
		[owner, repo, pullNumber],
	);
	const hasMounted = useHasMounted();
	const pageQueryKey = useMemo(
		() => githubQueryKeys.pulls.page(scope, input),
		[scope, input],
	);

	const pageQuery = useQuery({
		...githubPullPageQueryOptions(scope, input),
		enabled: hasMounted,
	});
	const viewerQuery = useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});
	const reviewCommentsQuery = useQuery({
		...githubPullReviewCommentsQueryOptions(scope, input),
		enabled: hasMounted && !!pageQuery.data,
	});
	const threadStatusesQuery = useQuery({
		...githubReviewThreadStatusesQueryOptions(scope, input),
		enabled: hasMounted && !!pageQuery.data,
	});

	const threadInfoByCommentId = useMemo(() => {
		const map = new Map<number, ReviewThreadInfo>();
		for (const t of threadStatusesQuery.data ?? []) {
			map.set(t.firstCommentId, {
				threadId: t.threadId,
				isResolved: t.isResolved,
			});
		}
		return map;
	}, [threadStatusesQuery.data]);

	const page = pageQuery.data;
	const pr = page?.detail;
	const viewerLogin = viewerQuery.data?.login;

	usePageTitle(pr?.title);

	useRegisterTab(
		registerTab && pr
			? {
					type: "pull",
					title: pr.title,
					number: pr.number,
					url: `/${owner}/${repo}/pull/${pullNumber}`,
					repo: `${owner}/${repo}`,
					iconColor: getPrStateConfig(pr).color,
					merged: pr.isMerged,
				}
			: null,
	);

	// Seed the header from a cached list row so it paints on the first frame.
	const queryClient = useQueryClient();
	const seed = useMemo(
		() => (pr ? undefined : findPullSummaryInLists(queryClient, scope, input)),
		[pr, queryClient, scope, input],
	);

	if (pageQuery.error) throw pageQuery.error;

	const bodyProps = {
		owner,
		repo,
		pullNumber,
		scope,
		pageQueryKey,
		viewerLogin,
	};

	return (
		<DetailPageLayout
			tabs={
				<PullDetailTabs
					owner={owner}
					repo={repo}
					pullNumber={pullNumber}
					pr={pr}
				/>
			}
			main={
				<>
					<div className="flex flex-col gap-8">
						<Skeleton loading={!pr && !seed}>
							{!pr && seed ? (
								<PullSeedTitle owner={owner} repo={repo} seed={seed} />
							) : (
								<PullDetailTitle
									owner={owner}
									repo={repo}
									pr={pr ?? SAMPLE_PULL}
								/>
							)}
						</Skeleton>
						<PullReviewRequest
							owner={owner}
							repo={repo}
							pullId={String(pullNumber)}
							pr={pr}
							viewerLogin={viewerLogin}
						/>
					</div>
					<Skeleton loading={!pr} label="Loading pull request">
						{page && pr ? (
							<PullDetailBody
								{...bodyProps}
								pr={pr}
								page={page}
								reviewComments={reviewCommentsQuery.data}
								threadInfoByCommentId={threadInfoByCommentId}
							/>
						) : (
							<SkeletonSample>
								<PullDetailBody
									{...bodyProps}
									pr={SAMPLE_PULL}
									page={SAMPLE_PULL_PAGE}
								/>
							</SkeletonSample>
						)}
					</Skeleton>
				</>
			}
			sidebar={
				<Skeleton data={pr} sample={SAMPLE_PULL}>
					{(detail) => (
						<PullDetailSidebar
							pr={detail}
							owner={owner}
							repo={repo}
							pullNumber={pullNumber}
							scope={scope}
							hasProductMap={page?.hasProductMap === true}
						/>
					)}
				</Skeleton>
			}
		/>
	);
}

function PullDetailTabs({
	owner,
	repo,
	pullNumber,
	pr,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	pr: PullDetail | null | undefined;
}) {
	return (
		<ViewTabs label="Pull request views">
			<ViewTab asChild>
				<Link
					to="/$owner/$repo/pull/$pullId"
					params={{ owner, repo, pullId: String(pullNumber) }}
					activeOptions={{ exact: true }}
				>
					Overview
				</Link>
			</ViewTab>
			<ViewTab asChild>
				<Link
					to="/$owner/$repo/review/$pullId"
					params={{ owner, repo, pullId: String(pullNumber) }}
				>
					Files changed
					{pr ? (
						<>
							<ViewTabCount>{pr.changedFiles}</ViewTabCount>
							<LineCounts
								additions={pr.additions}
								deletions={pr.deletions}
								className="ml-1.5 text-xs max-md:hidden"
							/>
						</>
					) : (
						<SkeletonBox width={14} height={12} radius={4} />
					)}
				</Link>
			</ViewTab>
		</ViewTabs>
	);
}

export function PullDetailBody({
	owner,
	repo,
	pullNumber,
	scope,
	pageQueryKey,
	viewerLogin,
	pr,
	page,
	reviewComments,
	threadInfoByCommentId,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
	pageQueryKey: readonly unknown[];
	viewerLogin: string | undefined;
	pr: PullDetail;
	page: PullPageData;
	reviewComments?: PullReviewComment[];
	threadInfoByCommentId?: ReadonlyMap<number, ReviewThreadInfo>;
	/** Unused: the body paints whatever is cached and never shows a fetch in progress. */
	isFetching?: boolean;
}) {
	return (
		<div className="flex flex-col gap-8">
			<PullBodySection
				pr={pr}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
				isAuthor={viewerLogin === pr.author?.login}
				scope={scope}
				viewerLogin={viewerLogin}
			/>

			{pr.isMerged || pr.state === "closed" ? (
				<PullStackSection pr={pr} owner={owner} repo={repo} scope={scope} />
			) : null}

			<PullDetailActivitySection
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
		</div>
	);
}

function PullSeedTitle({
	owner,
	repo,
	seed,
}: {
	owner: string;
	repo: string;
	seed: PullSummary;
}) {
	const stateConfig = getPrStateConfig(seed);
	return (
		<DetailPageTitle
			collectionHref="/pulls"
			collectionLabel="Pull Requests"
			owner={owner}
			repo={repo}
			number={seed.number}
			icon={stateConfig.icon}
			iconClassName={stateConfig.color}
			title={seed.title}
			subtitle={
				<div className="flex min-w-0 items-center gap-1.5 text-xs font-[450] text-muted-foreground">
					<StatePill tone={stateConfig.tone}>{stateConfig.label}</StatePill>
					{seed.author && (
						<>
							<img
								src={seed.author.avatarUrl}
								alt={seed.author.login}
								className="size-4 shrink-0 rounded-full ring-[0.5px] ring-chip-border"
							/>
							<span className="shrink-0 font-medium text-foreground">
								{seed.author.login}
							</span>
						</>
					)}
				</div>
			}
		/>
	);
}
