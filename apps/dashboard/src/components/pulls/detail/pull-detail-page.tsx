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
	githubPullPageQueryOptions,
	githubPullReviewCommentsQueryOptions,
	githubQueryKeys,
	githubReviewThreadStatusesQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { PullBodySection } from "./pull-body-section";
import { PullDetailActivitySection } from "./pull-detail-activity";
import { getPrStateConfig, PullDetailHeader } from "./pull-detail-header";
import { PullDetailSidebar } from "./pull-detail-sidebar";

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
	const webhookRefreshTargets = useMemo(
		() => [
			{
				queryKey: pageQueryKey,
				signalKeys: [githubRevalidationSignalKeys.pullEntity(input)],
			},
			{
				queryKey: githubQueryKeys.pulls.status(scope, input),
				signalKeys: [githubRevalidationSignalKeys.pullEntity(input)],
			},
		],
		[pageQueryKey, scope, input],
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
	useGitHubSignalStream(webhookRefreshTargets);

	const threadInfoByCommentId = useMemo(() => {
		const map = new Map<number, { threadId: string; isResolved: boolean }>();
		for (const t of threadStatusesQuery.data ?? []) {
			map.set(t.firstCommentId, {
				threadId: t.threadId,
				isResolved: t.isResolved,
			});
		}
		return map;
	}, [threadStatusesQuery.data]);

	const pr = pageQuery.data?.detail;
	const comments = pageQuery.data?.comments;
	const commits = pageQuery.data?.commits;
	const events = pageQuery.data?.events;
	const commentPagination = pageQuery.data?.commentPagination;
	const eventPagination = pageQuery.data?.eventPagination;
	const headRefDeleted = pageQuery.data?.headRefDeleted ?? false;
	const viewer = viewerQuery.data ?? null;

	useRegisterTab(
		registerTab && pr
			? {
					type: "pull",
					title: pr.title,
					number: pr.number,
					url: `/${owner}/${repo}/pull/${pullNumber}`,
					repo: `${owner}/${repo}`,
					iconColor: getPrStateConfig(pr).color,
				}
			: null,
	);

	if (pageQuery.error) throw pageQuery.error;
	if (!pr) return <PullDetailPageSkeleton />;

	return (
		<DetailPageLayout
			main={
				<>
					<PullDetailHeader
						owner={owner}
						repo={repo}
						pullId={String(pullNumber)}
						pr={pr}
						viewerLogin={viewer?.login}
					/>

					<PullBodySection
						pr={pr}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						isAuthor={viewer?.login === pr.author?.login}
						scope={scope}
					/>

					<PullDetailActivitySection
						comments={comments}
						commits={commits}
						events={events}
						reviewComments={reviewCommentsQuery.data}
						commentPagination={commentPagination}
						eventPagination={eventPagination}
						pageQueryKey={pageQueryKey}
						isFetching={pageQuery.isFetching}
						pr={pr}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						scope={scope}
						headRefDeleted={headRefDeleted}
						viewerLogin={viewer?.login}
						threadInfoByCommentId={threadInfoByCommentId}
					/>
				</>
			}
			sidebar={
				<PullDetailSidebar
					pr={pr}
					owner={owner}
					repo={repo}
					pullNumber={pullNumber}
					scope={scope}
					comments={comments ?? []}
					commits={commits ?? []}
				/>
			}
		/>
	);
}

function PullDetailPageSkeleton() {
	return (
		<DetailPageSkeletonLayout mainItemCount={5}>
			<StaggerItem index={0}>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-3 w-32" />
					<div className="flex items-start gap-3">
						<Skeleton className="mt-1 size-5 rounded-full" />
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton className="h-7 w-3/5" />
							<div className="flex items-center gap-2">
								<Skeleton className="h-5 w-14 rounded-full" />
								<Skeleton className="h-4 w-64" />
							</div>
						</div>
					</div>
				</div>
			</StaggerItem>

			<StaggerItem index={1}>
				<div className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-2.5">
					<Skeleton className="h-4 w-20" />
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-24" />
				</div>
			</StaggerItem>

			<StaggerItem index={2}>
				<div className="rounded-lg border bg-surface-0 p-5">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
						<Skeleton className="h-4 w-2/3" />
					</div>
				</div>
			</StaggerItem>

			<StaggerItem index={3}>
				<div className="flex flex-col gap-6">
					<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-6" />
					</div>
					<div className="flex flex-col gap-5 pl-8">
						{/* Comment */}
						<div className="flex items-start gap-2">
							<Skeleton className="size-5 rounded-full" />
							<div className="flex flex-col gap-1.5">
								<Skeleton className="h-3.5 w-36" />
								<Skeleton className="h-12 w-64 rounded-lg" />
							</div>
						</div>
						{/* Commit */}
						<div className="flex items-center gap-2">
							<Skeleton className="size-4 rounded" />
							<Skeleton className="h-3.5 w-52" />
						</div>
						{/* Review */}
						<div className="flex items-start gap-2">
							<Skeleton className="size-5 rounded-full" />
							<div className="flex flex-col gap-1.5">
								<Skeleton className="h-3.5 w-44" />
								<Skeleton className="h-3.5 w-28" />
							</div>
						</div>
						{/* Label event */}
						<div className="flex items-center gap-2">
							<Skeleton className="size-4 rounded" />
							<Skeleton className="h-3.5 w-32" />
							<Skeleton className="h-5 w-16 rounded-full" />
						</div>
					</div>
				</div>
			</StaggerItem>

			<StaggerItem index={4}>
				<div className="rounded-lg border p-4">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<Skeleton className="size-5 rounded-full" />
							<Skeleton className="h-4 w-40" />
						</div>
						<Skeleton className="h-9 w-24 rounded-lg" />
					</div>
				</div>
			</StaggerItem>
		</DetailPageSkeletonLayout>
	);
}
