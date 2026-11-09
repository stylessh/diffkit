import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import { Skeleton } from "skullet/react";
import { DetailPageLayout } from "#/components/details/detail-page";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import {
	type GitHubQueryScope,
	githubIssuePageQueryOptions,
	githubQueryKeys,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type { IssueDetail, IssuePageData } from "#/lib/github.types";
import { findIssueSummaryInLists } from "#/lib/github-query-updates";
import { useHasMounted } from "#/lib/use-has-mounted";
import { usePageTitle } from "#/lib/use-page-title";
import { useRegisterTab } from "#/lib/use-register-tab";
import { IssueDetailActivitySection } from "./issue-detail-activity";
import {
	getIssueStateConfig,
	IssueDescription,
	IssueDetailTitle,
} from "./issue-detail-header";
import { SAMPLE_ISSUE, SAMPLE_ISSUE_PAGE } from "./issue-detail-samples";
import { IssueDetailSidebar } from "./issue-detail-sidebar";

const routeApi = getRouteApi("/_protected/$owner/$repo/issues/$issueId");

export function IssueDetailPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, issueId } = routeApi.useParams();

	return (
		<IssueDetailContent
			owner={owner}
			repo={repo}
			issueNumber={Number(issueId)}
			userId={user.id}
			registerTab
		/>
	);
}

export type IssueDetailContentProps = {
	owner: string;
	repo: string;
	issueNumber: number;
	userId: string;
	registerTab?: boolean;
};

export function IssueDetailContent({
	owner,
	repo,
	issueNumber,
	userId,
	registerTab = false,
}: IssueDetailContentProps) {
	const scope = useMemo(() => ({ userId }), [userId]);
	const input = useMemo(
		() => ({ owner, repo, issueNumber }),
		[owner, repo, issueNumber],
	);
	const hasMounted = useHasMounted();
	const pageQueryKey = useMemo(
		() => githubQueryKeys.issues.page(scope, input),
		[scope, input],
	);

	const pageQuery = useQuery({
		...githubIssuePageQueryOptions(scope, input),
		enabled: hasMounted,
	});
	const viewerQuery = useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});

	const page = pageQuery.data;
	const issue = page?.detail;
	const viewerLogin = viewerQuery.data?.login;

	usePageTitle(issue?.title);

	useRegisterTab(
		registerTab && issue
			? {
					type: "issue",
					title: issue.title,
					number: issue.number,
					url: `/${owner}/${repo}/issues/${issueNumber}`,
					repo: `${owner}/${repo}`,
					iconColor: getIssueStateConfig(issue).color,
				}
			: null,
	);

	// Seed the header from a cached list row so it paints on the first frame.
	const queryClient = useQueryClient();
	const seed = useMemo(
		() =>
			issue ? undefined : findIssueSummaryInLists(queryClient, scope, input),
		[issue, queryClient, scope, input],
	);

	if (pageQuery.error) throw pageQuery.error;

	const activityProps = {
		owner,
		repo,
		issueNumber,
		scope,
		pageQueryKey,
		viewerLogin,
	};

	return (
		<DetailPageLayout
			main={
				<>
					<div className="flex flex-col gap-8">
						<Skeleton loading={!issue && !seed}>
							<IssueDetailTitle
								owner={owner}
								repo={repo}
								issue={issue ?? seed ?? SAMPLE_ISSUE}
							/>
						</Skeleton>
						<Skeleton loading={!issue} label="Loading description">
							{issue ? (
								<IssueDescription
									owner={owner}
									repo={repo}
									issue={issue}
									scope={scope}
									viewerLogin={viewerLogin}
								/>
							) : (
								<SkeletonSample>
									<IssueDescription
										owner={owner}
										repo={repo}
										issue={SAMPLE_ISSUE}
										scope={scope}
										viewerLogin={viewerLogin}
									/>
								</SkeletonSample>
							)}
						</Skeleton>
					</div>
					<Skeleton loading={!issue} label="Loading issue">
						{page && issue ? (
							<IssueDetailActivity
								{...activityProps}
								issue={issue}
								page={page}
								isFetching={pageQuery.isFetching}
							/>
						) : (
							<SkeletonSample>
								<IssueDetailActivity
									{...activityProps}
									issue={SAMPLE_ISSUE}
									page={SAMPLE_ISSUE_PAGE}
									isFetching={false}
								/>
							</SkeletonSample>
						)}
					</Skeleton>
				</>
			}
			sidebar={
				<Skeleton data={issue} sample={SAMPLE_ISSUE}>
					{(detail) => (
						<IssueDetailSidebar
							issue={detail}
							owner={owner}
							repo={repo}
							issueNumber={issueNumber}
							scope={scope}
						/>
					)}
				</Skeleton>
			}
		/>
	);
}

function IssueDetailActivity({
	owner,
	repo,
	issueNumber,
	scope,
	pageQueryKey,
	viewerLogin,
	issue,
	page,
	isFetching,
}: {
	owner: string;
	repo: string;
	issueNumber: number;
	scope: GitHubQueryScope;
	pageQueryKey: readonly unknown[];
	viewerLogin: string | undefined;
	issue: IssueDetail;
	page: IssuePageData;
	isFetching: boolean;
}) {
	return (
		<IssueDetailActivitySection
			comments={page.comments}
			events={page.events}
			commentPagination={page.commentPagination}
			eventPagination={page.eventPagination}
			pageQueryKey={pageQueryKey}
			isFetching={isFetching}
			owner={owner}
			repo={repo}
			issueNumber={issueNumber}
			scope={scope}
			issueAuthor={issue.author}
			issueState={issue.state === "closed" ? "closed" : "open"}
			issueClosedAt={issue.closedAt}
			issueStateReason={issue.stateReason}
			viewerLogin={viewerLogin}
		/>
	);
}
