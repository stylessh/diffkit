import { Skeleton } from "@diffkit/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import {
	DetailPageLayout,
	DetailPageSkeletonLayout,
	StaggerItem,
} from "#/components/details/detail-page";
import {
	githubIssuePageQueryOptions,
	githubQueryKeys,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { IssueDetailActivitySection } from "./issue-detail-activity";
import { getIssueStateConfig, IssueDetailHeader } from "./issue-detail-header";
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
	const webhookRefreshTargets = useMemo(
		() => [
			{
				queryKey: pageQueryKey,
				signalKeys: [githubRevalidationSignalKeys.issueEntity(input)],
			},
		],
		[pageQueryKey, input],
	);

	const pageQuery = useQuery({
		...githubIssuePageQueryOptions(scope, input),
		enabled: hasMounted,
	});
	const viewerQuery = useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});
	useGitHubSignalStream(webhookRefreshTargets);

	const issue = pageQuery.data?.detail;
	const comments = pageQuery.data?.comments;
	const events = pageQuery.data?.events;
	const commentPagination = pageQuery.data?.commentPagination;
	const eventPagination = pageQuery.data?.eventPagination;

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

	if (pageQuery.error) throw pageQuery.error;
	if (!issue) return <IssueDetailPageSkeleton />;

	return (
		<DetailPageLayout
			main={
				<>
					<IssueDetailHeader owner={owner} repo={repo} issue={issue} />
					<IssueDetailActivitySection
						comments={comments}
						events={events}
						commentPagination={commentPagination}
						eventPagination={eventPagination}
						pageQueryKey={pageQueryKey}
						isFetching={pageQuery.isFetching}
						owner={owner}
						repo={repo}
						issueNumber={issueNumber}
						scope={scope}
						issueAuthor={issue.author}
						viewerLogin={viewerQuery.data?.login}
					/>
				</>
			}
			sidebar={
				<IssueDetailSidebar
					issue={issue}
					owner={owner}
					repo={repo}
					issueNumber={issueNumber}
					scope={scope}
					comments={comments ?? []}
				/>
			}
		/>
	);
}

function IssueDetailPageSkeleton() {
	return (
		<DetailPageSkeletonLayout mainItemCount={4}>
			<StaggerItem index={0}>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-4 w-48 rounded-md" />
					<div className="flex items-start gap-3">
						<Skeleton className="mt-1 size-5 rounded-full" />
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton className="h-8 w-3/4 rounded-md" />
							<div className="flex gap-2">
								<Skeleton className="h-5 w-16 rounded-full" />
								<Skeleton className="h-4 w-48" />
							</div>
						</div>
					</div>
				</div>
			</StaggerItem>

			<StaggerItem index={1}>
				<div className="flex flex-wrap gap-1.5">
					<Skeleton className="h-6 w-20 rounded-full" />
					<Skeleton className="h-6 w-24 rounded-full" />
				</div>
			</StaggerItem>

			<StaggerItem index={2}>
				<div className="rounded-lg border bg-surface-0 p-5">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-4 w-full rounded-md" />
						<Skeleton className="h-4 w-5/6 rounded-md" />
						<Skeleton className="h-4 w-2/3 rounded-md" />
					</div>
				</div>
			</StaggerItem>

			<StaggerItem index={3}>
				<div className="flex flex-col gap-6">
					<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
						<Skeleton className="h-4 w-14 rounded-md" />
						<Skeleton className="h-4 w-6 rounded-md" />
					</div>
					<div className="flex flex-col gap-5 pl-8">
						{/* Comment */}
						<div className="flex items-start gap-2">
							<Skeleton className="size-5 rounded-full" />
							<div className="flex flex-col gap-1.5">
								<Skeleton className="h-3.5 w-36 rounded-md" />
								<Skeleton className="h-12 w-64 rounded-lg" />
							</div>
						</div>
						{/* Label event */}
						<div className="flex items-center gap-2">
							<Skeleton className="size-4 rounded" />
							<Skeleton className="h-3.5 w-32 rounded-md" />
							<Skeleton className="h-5 w-16 rounded-full" />
						</div>
						{/* Comment */}
						<div className="flex items-start gap-2">
							<Skeleton className="size-5 rounded-full" />
							<div className="flex flex-col gap-1.5">
								<Skeleton className="h-3.5 w-44 rounded-md" />
								<Skeleton className="h-3.5 w-56 rounded-md" />
							</div>
						</div>
						{/* Assignment */}
						<div className="flex items-center gap-2">
							<Skeleton className="size-4 rounded" />
							<Skeleton className="h-3.5 w-40 rounded-md" />
						</div>
					</div>
				</div>
			</StaggerItem>
		</DetailPageSkeletonLayout>
	);
}
