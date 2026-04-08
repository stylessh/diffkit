import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/reviews")({
	component: ReviewsPage,
});

function ReviewsPage() {
	const { user } = Route.useRouteContext();
	const hasMounted = useHasMounted();
	const query = useQuery({
		...githubMyPullsQueryOptions({ userId: user.id }),
		enabled: hasMounted,
	});

	if (query.error) throw query.error;
	if (query.data) {
		const data = query.data;

		return (
			<div className="flex h-full flex-col gap-6 overflow-auto p-6">
				<header className="space-y-1">
					<p className="text-sm font-medium text-muted-foreground">
						Review requests stay warm in the shared pull request cache.
					</p>
					<h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
				</header>

				<section className="rounded-2xl border bg-background/70 p-4">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-medium">Requested reviews</h2>
						<span className="text-sm text-muted-foreground">
							{data.reviewRequested.length}
						</span>
					</div>
					{data.reviewRequested.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No review requests found.
						</p>
					) : (
						<div className="space-y-3">
							{data.reviewRequested.map((pull) => (
								<div key={pull.id} className="rounded-xl border px-3 py-2">
									<p className="text-sm font-medium">
										#{pull.number} {pull.title}
									</p>
									<p className="text-sm text-muted-foreground">
										{pull.repository.fullName}
									</p>
								</div>
							))}
						</div>
					)}
				</section>
			</div>
		);
	}
	if (hasMounted && query.isPending) {
		return <DashboardContentLoading />;
	}

	return null;
}
