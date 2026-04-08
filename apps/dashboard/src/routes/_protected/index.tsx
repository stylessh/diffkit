import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
	githubUserReposQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";

export const Route = createFileRoute("/_protected/")({
	loader: async ({ context }) => {
		const scope = { userId: context.user.id };

		await Promise.all([
			context.queryClient.ensureQueryData(githubViewerQueryOptions(scope)),
			context.queryClient.ensureQueryData(githubUserReposQueryOptions(scope)),
			context.queryClient.ensureQueryData(githubMyPullsQueryOptions(scope)),
			context.queryClient.ensureQueryData(githubMyIssuesQueryOptions(scope)),
		]);
	},
	component: OverviewPage,
});

function OverviewPage() {
	const { user } = Route.useRouteContext();
	const scope = { userId: user.id };
	const { data: viewer } = useSuspenseQuery(githubViewerQueryOptions(scope));
	const { data: repos } = useSuspenseQuery(githubUserReposQueryOptions(scope));
	const { data: pulls } = useSuspenseQuery(githubMyPullsQueryOptions(scope));
	const { data: issues } = useSuspenseQuery(githubMyIssuesQueryOptions(scope));

	const pullCount =
		pulls.reviewRequested.length +
		pulls.assigned.length +
		pulls.authored.length +
		pulls.mentioned.length +
		pulls.involved.length;
	const issueCount =
		issues.assigned.length + issues.authored.length + issues.mentioned.length;

	return (
		<div className="flex h-full flex-col gap-6 overflow-auto p-6">
			<div className="space-y-1">
				<p className="text-sm font-medium text-muted-foreground">
					GitHub cache primed
				</p>
				<h1 className="text-2xl font-semibold tracking-tight">
					{viewer?.name ?? viewer?.login ?? user.name ?? user.email}
				</h1>
				<p className="text-sm text-muted-foreground">
					Overview is preloading your viewer, repo, pull request, and issue
					queries so the next tabs feel instant.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<SummaryCard
					label="Tracked repositories"
					value={repos.length}
					description="Loaded from the authenticated repo list."
				/>
				<SummaryCard
					label="Open pull request slices"
					value={pullCount}
					description="Review, assigned, authored, mentioned, and involved."
				/>
				<SummaryCard
					label="Open issue slices"
					value={issueCount}
					description="Assigned, authored, and mentioned issue groups."
				/>
			</div>

			<div className="grid gap-4 xl:grid-cols-2">
				<PreviewList
					title="Recently active repositories"
					emptyLabel="No repositories cached yet."
					items={repos.slice(0, 5).map((repo) => ({
						id: repo.id,
						title: repo.fullName,
						description:
							repo.description ??
							`${repo.stars} stars${repo.language ? ` • ${repo.language}` : ""}`,
					}))}
				/>
				<PreviewList
					title="Review requests"
					emptyLabel="No review requests found."
					items={pulls.reviewRequested.slice(0, 5).map((pull) => ({
						id: pull.id,
						title: `#${pull.number} ${pull.title}`,
						description: pull.repository.fullName,
					}))}
				/>
				<PreviewList
					title="Assigned issues"
					emptyLabel="No assigned issues found."
					items={issues.assigned.slice(0, 5).map((issue) => ({
						id: issue.id,
						title: `#${issue.number} ${issue.title}`,
						description: issue.repository.fullName,
					}))}
				/>
				<PreviewList
					title="Authored pull requests"
					emptyLabel="No authored pull requests found."
					items={pulls.authored.slice(0, 5).map((pull) => ({
						id: pull.id,
						title: `#${pull.number} ${pull.title}`,
						description: pull.repository.fullName,
					}))}
				/>
			</div>
		</div>
	);
}

function SummaryCard({
	label,
	value,
	description,
}: {
	label: string;
	value: number;
	description: string;
}) {
	return (
		<div className="rounded-2xl border bg-background/70 p-4">
			<p className="text-sm font-medium text-muted-foreground">{label}</p>
			<p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
			<p className="mt-2 text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

function PreviewList({
	title,
	emptyLabel,
	items,
}: {
	title: string;
	emptyLabel: string;
	items: Array<{ id: number; title: string; description: string }>;
}) {
	return (
		<section className="rounded-2xl border bg-background/70 p-4">
			<div className="mb-3">
				<h2 className="font-medium">{title}</h2>
			</div>
			{items.length === 0 ? (
				<p className="text-sm text-muted-foreground">{emptyLabel}</p>
			) : (
				<div className="space-y-3">
					{items.map((item) => (
						<div key={item.id} className="rounded-xl border px-3 py-2">
							<p className="text-sm font-medium">{item.title}</p>
							<p className="text-sm text-muted-foreground">
								{item.description}
							</p>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
