import { Skeleton } from "@diffkit/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
	DetailPageLayout,
	DetailPageSkeletonLayout,
} from "#/components/details/detail-page";
import {
	githubIssuePageQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";
import { IssueDetailActivitySection } from "./issue-detail-activity";
import { getIssueStateConfig, IssueDetailHeader } from "./issue-detail-header";
import { IssueDetailSidebar } from "./issue-detail-sidebar";

const routeApi = getRouteApi("/_protected/$owner/$repo/issues/$issueId");

export function IssueDetailPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, issueId } = routeApi.useParams();
	const issueNumber = Number(issueId);
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	const pageQuery = useQuery({
		...githubIssuePageQueryOptions(scope, { owner, repo, issueNumber }),
		enabled: hasMounted,
	});

	const issue = pageQuery.data?.detail;
	const comments = pageQuery.data?.comments;
	const events = pageQuery.data?.events;
	const commentPagination = pageQuery.data?.commentPagination;
	const eventPagination = pageQuery.data?.eventPagination;

	useRegisterTab(
		issue
			? {
					type: "issue",
					title: issue.title,
					number: issue.number,
					url: `/${owner}/${repo}/issues/${issueId}`,
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
						pageQueryKey={githubQueryKeys.issues.page(scope, {
							owner,
							repo,
							issueNumber,
						})}
						isFetching={pageQuery.isFetching}
						owner={owner}
						repo={repo}
						issueNumber={issueNumber}
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
		<DetailPageSkeletonLayout
			main={
				<>
					<div className="flex flex-col gap-3">
						<Skeleton className="h-4 w-48 rounded-md" />
						<div className="flex items-start gap-3">
							<Skeleton className="mt-1 size-5 rounded-full" />
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<Skeleton className="h-8 w-3/4 rounded-md" />
								<div className="flex gap-2">
									<Skeleton className="h-6 w-16 rounded-full" />
									<Skeleton className="h-6 w-48 rounded-full" />
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-wrap gap-1.5">
						<Skeleton className="h-6 w-20 rounded-full" />
						<Skeleton className="h-6 w-24 rounded-full" />
					</div>

					<div className="rounded-lg border bg-surface-0 p-5">
						<div className="flex flex-col gap-2">
							<Skeleton className="h-4 w-full rounded-md" />
							<Skeleton className="h-4 w-[92%] rounded-md" />
							<Skeleton className="h-4 w-[78%] rounded-md" />
							<Skeleton className="h-4 w-[66%] rounded-md" />
						</div>
					</div>

					<div className="flex flex-col">
						<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
							<Skeleton className="h-4 w-14 rounded-md" />
							<Skeleton className="h-4 w-6 rounded-md" />
						</div>
						<div className="relative flex flex-col gap-5 py-5 pl-8 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
							{["activity-1", "activity-2", "activity-3"].map((key) => (
								<div key={key} className="flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<Skeleton className="size-4 rounded-full" />
										<Skeleton className="h-4 w-24 rounded-md" />
										<Skeleton className="h-4 w-16 rounded-md" />
									</div>
									<Skeleton className="h-4 w-[88%] rounded-md" />
									<Skeleton className="h-4 w-[72%] rounded-md" />
								</div>
							))}
						</div>
					</div>
				</>
			}
		/>
	);
}
