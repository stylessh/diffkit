import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { githubMyIssuesQueryOptions } from "#/lib/github.query";
import type { IssueSummary } from "#/lib/github.types";

export const Route = createFileRoute("/_protected/issues")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(
			githubMyIssuesQueryOptions({ userId: context.user.id }),
		);
	},
	component: IssuesPage,
});

function IssuesPage() {
	const { user } = Route.useRouteContext();
	const { data } = useSuspenseQuery(
		githubMyIssuesQueryOptions({ userId: user.id }),
	);

	return (
		<div className="flex h-full flex-col gap-6 overflow-auto p-6">
			<header className="space-y-1">
				<p className="text-sm font-medium text-muted-foreground">
					Cached issue groups
				</p>
				<h1 className="text-2xl font-semibold tracking-tight">Issues</h1>
			</header>

			<div className="grid gap-4 xl:grid-cols-3">
				<IssueGroup title="Assigned" issues={data.assigned} />
				<IssueGroup title="Authored" issues={data.authored} />
				<IssueGroup title="Mentioned" issues={data.mentioned} />
			</div>
		</div>
	);
}

function IssueGroup({
	title,
	issues,
}: {
	title: string;
	issues: IssueSummary[];
}) {
	return (
		<section className="rounded-2xl border bg-background/70 p-4">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-medium">{title}</h2>
				<span className="text-sm text-muted-foreground">{issues.length}</span>
			</div>
			{issues.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No issues in this slice.
				</p>
			) : (
				<div className="space-y-3">
					{issues.map((issue) => (
						<div key={issue.id} className="rounded-xl border px-3 py-2">
							<p className="text-sm font-medium">
								#{issue.number} {issue.title}
							</p>
							<p className="text-sm text-muted-foreground">
								{issue.repository.fullName}
							</p>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
