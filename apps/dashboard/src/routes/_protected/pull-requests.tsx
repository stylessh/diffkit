import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { githubMyPullsQueryOptions } from "#/lib/github.query";
import type { PullSummary } from "#/lib/github.types";

export const Route = createFileRoute("/_protected/pull-requests")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(
			githubMyPullsQueryOptions({ userId: context.user.id }),
		);
	},
	component: PullRequestsPage,
});

function PullRequestsPage() {
	const { user } = Route.useRouteContext();
	const { data } = useSuspenseQuery(
		githubMyPullsQueryOptions({ userId: user.id }),
	);

	return (
		<div className="flex h-full flex-col gap-6 overflow-auto p-6">
			<header className="space-y-1">
				<p className="text-sm font-medium text-muted-foreground">
					Cached pull request groups
				</p>
				<h1 className="text-2xl font-semibold tracking-tight">Pull Requests</h1>
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
