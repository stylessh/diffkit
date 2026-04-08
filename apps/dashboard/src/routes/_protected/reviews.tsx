import { ReviewsIcon } from "@quickhub/icons";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/reviews")({
	loader: async ({ context }) => {
		const scope = { userId: context.user.id };
		await context.queryClient.ensureQueryData(githubMyPullsQueryOptions(scope));
	},
	component: ReviewsPage,
});

function ReviewsPage() {
	const { user } = Route.useRouteContext();
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const query = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});

	if (query.error) throw query.error;
	if (query.data) {
		const reviews = query.data.reviewRequested;

		return (
			<div ref={scrollContainerRef} className="h-full overflow-auto py-10">
				<div className="mx-auto grid max-w-7xl gap-14 px-6 xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
					<aside className="flex h-fit flex-col gap-5 xl:sticky xl:top-0">
						<div className="flex flex-col gap-2">
							<h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
							<p className="text-sm text-muted-foreground">
								<span className="tabular-nums">{reviews.length}</span> open
								pulls requesting your review
							</p>
						</div>

						<div className="flex items-center justify-between gap-4 rounded-xl bg-surface-1 px-3.5 py-3">
							<div className="flex min-w-0 items-center gap-2">
								<div className="shrink-0 text-muted-foreground">
									<ReviewsIcon size={15} strokeWidth={1.9} />
								</div>
								<p className="truncate text-sm font-medium">Review requested</p>
							</div>
							<p className="font-semibold tabular-nums leading-tight">
								{reviews.length}
							</p>
						</div>
					</aside>

					<div className="flex flex-col gap-2">
						{reviews.length === 0 ? (
							<p className="px-3 py-6 text-center text-sm text-muted-foreground">
								No review requests right now — you're all caught up.
							</p>
						) : (
							<div className="flex flex-col gap-1">
								{reviews.map((pr) => (
									<PullRequestRow key={pr.id} pr={pr} scope={scope} />
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}
	if (hasMounted && query.isPending) {
		return <DashboardContentLoading />;
	}

	return null;
}
