import { Skeleton } from "@diffkit/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
	DetailPageLayout,
	DetailPageSkeletonLayout,
} from "#/components/details/detail-page";
import {
	githubPullPageQueryOptions,
	githubQueryKeys,
	githubViewerQueryOptions,
} from "#/lib/github.query";
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
	const pullNumber = Number(pullId);
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	const pageQuery = useQuery({
		...githubPullPageQueryOptions(scope, { owner, repo, pullNumber }),
		enabled: hasMounted,
	});
	const viewerQuery = useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});

	const pr = pageQuery.data?.detail;
	const comments = pageQuery.data?.comments;
	const commits = pageQuery.data?.commits;
	const events = pageQuery.data?.events;
	const commentPagination = pageQuery.data?.commentPagination;
	const eventPagination = pageQuery.data?.eventPagination;
	const viewer = viewerQuery.data ?? null;

	useRegisterTab(
		pr
			? {
					type: "pull",
					title: pr.title,
					number: pr.number,
					url: `/${owner}/${repo}/pull/${pullId}`,
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
						pullId={pullId}
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
						commentPagination={commentPagination}
						eventPagination={eventPagination}
						pageQueryKey={githubQueryKeys.pulls.page(scope, {
							owner,
							repo,
							pullNumber,
						})}
						isFetching={pageQuery.isFetching}
						pr={pr}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						scope={scope}
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
		<DetailPageSkeletonLayout
			main={
				<>
					<div className="flex flex-col gap-3">
						<Skeleton className="h-3 w-32" />
						<div className="flex items-start gap-3">
							<Skeleton className="mt-1 size-5 rounded-full" />
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<Skeleton className="h-7 w-3/5" />
								<div className="flex flex-wrap items-center gap-2">
									<Skeleton className="h-5 w-14 rounded-full" />
									<Skeleton className="h-4 w-64" />
								</div>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-2.5">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-24" />
					</div>

					<div className="rounded-lg border bg-surface-0 p-5">
						<div className="flex flex-col gap-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-5/6" />
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-4 w-3/4" />
						</div>
					</div>

					<div className="flex flex-col gap-6">
						<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-6" />
						</div>
						<div className="flex flex-col gap-4 pl-8">
							{[0, 1, 2].map((item) => (
								<div key={item} className="flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<Skeleton className="size-4 rounded-full" />
										<Skeleton className="h-3.5 w-24" />
										<Skeleton className="h-3.5 w-16" />
									</div>
									<Skeleton className="h-4 w-5/6" />
									<Skeleton className="h-4 w-2/3" />
								</div>
							))}
						</div>
						<div className="flex flex-col rounded-lg border">
							{[0, 1, 2].map((item) => (
								<div
									key={item}
									className="flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
								>
									<Skeleton className="mt-0.5 size-4 rounded-full" />
									<div className="flex flex-1 flex-col gap-1.5">
										<Skeleton className="h-3.5 w-48" />
										<Skeleton className="h-3 w-72" />
									</div>
								</div>
							))}
						</div>
					</div>
				</>
			}
		/>
	);
}
