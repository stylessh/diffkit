import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";

export const Route = createFileRoute("/_protected/pulls")({
	component: PullRequestsPage,
});

function PullRequestsPage() {
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
						Cached pull request groups
					</p>
					<h1 className="text-2xl font-semibold tracking-tight">
						Pull Requests
					</h1>
				</header>

				<div className="grid gap-4 xl:grid-cols-2">
					<PullGroup title="Review requested" pulls={data.reviewRequested} />
					<PullGroup title="Assigned" pulls={data.assigned} />
					<PullGroup title="Authored" pulls={data.authored} />
					<PullGroup title="Mentioned" pulls={data.mentioned} />
					<PullGroup title="Involved" pulls={data.involved} />
				</div>
			</div>
		);
	}
	if (hasMounted && query.isPending) {
		return <DashboardContentLoading />;
	}

	return null;
}

function PullGroup({ title, pulls }: { title: string; pulls: PullSummary[] }) {
	return (
		<section className="rounded-2xl border bg-background/70 p-4">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-medium">{title}</h2>
				<span className="text-sm text-muted-foreground">{pulls.length}</span>
			</div>
			{pulls.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No pull requests in this slice.
				</p>
			) : (
				<div className="space-y-3">
					{pulls.map((pull) => (
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
	);
}
