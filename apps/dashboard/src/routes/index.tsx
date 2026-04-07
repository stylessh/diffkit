import { createFileRoute, Link } from "@tanstack/react-router";
import { getSession } from "#/lib/auth.functions";
import { getUserRepos } from "#/lib/github.functions";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const session = await getSession();
		return { session };
	},
	loader: async ({ context }) => {
		if (!context.session) return { repos: [] };
		const repos = await getUserRepos();
		return { repos };
	},
	component: Home,
});

function Home() {
	const { session } = Route.useRouteContext();
	const { repos } = Route.useLoaderData();

	return (
		<main className="mx-auto max-w-2xl px-4 py-16">
			<div className="text-center space-y-6">
				<h1 className="text-4xl font-bold tracking-tight">QuickHub</h1>
				<p className="text-muted-foreground">
					A lightweight, focused view of GitHub.
				</p>
				{session ? (
					<Link
						to="/dashboard"
						className="inline-block rounded-md bg-neutral-900 px-6 py-3 text-white hover:bg-neutral-800 transition-colors"
					>
						Go to Dashboard
					</Link>
				) : (
					<Link
						to="/login"
						className="inline-block rounded-md bg-neutral-900 px-6 py-3 text-white hover:bg-neutral-800 transition-colors"
					>
						Sign in with GitHub
					</Link>
				)}
			</div>

			{repos.length > 0 && (
				<div className="mt-12 space-y-3">
					<h2 className="text-lg font-semibold">Recent repositories</h2>
					<ul className="divide-y divide-neutral-200">
						{repos.map((repo) => (
							<li key={repo.id} className="py-3">
								<div className="flex items-center justify-between">
									<div>
										<a
											href={repo.url}
											target="_blank"
											rel="noopener noreferrer"
											className="font-medium hover:underline"
										>
											{repo.name}
										</a>
										{repo.isPrivate && (
											<span className="ml-2 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
												private
											</span>
										)}
									</div>
									<div className="flex items-center gap-3 text-sm text-muted-foreground">
										{repo.language && <span>{repo.language}</span>}
										{repo.stars ? <span>{repo.stars} stars</span> : null}
									</div>
								</div>
								{repo.description && (
									<p className="mt-1 text-sm text-muted-foreground">
										{repo.description}
									</p>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</main>
	);
}
