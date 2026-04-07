import { Badge } from "@quickhub/ui/components/badge";
import { Button } from "@quickhub/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@quickhub/ui/components/card";
import { Logo } from "@quickhub/ui/components/logo";
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
	const ctaCopy = session ? "Open dashboard" : "Continue with GitHub";
	const ctaLink = session ? "/dashboard" : "/login";

	return (
		<main className="min-h-dvh bg-[radial-gradient(circle_at_top,_color-mix(in_oklch,_var(--color-primary)_6%,_transparent),_transparent_48%),linear-gradient(180deg,_color-mix(in_oklch,_var(--color-secondary)_65%,_white)_0%,_transparent_45%)]">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
				<section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,420px)]">
					<Card className="border-border/70 bg-background/90 shadow-sm backdrop-blur">
						<CardHeader className="gap-5">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-3">
									<Logo />
									<div>
										<p className="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">
											QuickHub
										</p>
										<p className="text-sm text-muted-foreground">
											Placeholder logo
										</p>
									</div>
								</div>
								<Badge variant="outline" className="w-fit">
									Shared UI baseline
								</Badge>
							</div>
							<div className="space-y-3">
								<CardTitle className="text-3xl tracking-tight sm:text-4xl">
									QuickHub, now on a shared UI foundation.
								</CardTitle>
								<CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
									Circle&apos;s tokens and primitives are now the baseline for
									QuickHub, so the app can grow from a consistent design system
									instead of ad hoc styles.
								</CardDescription>
							</div>
						</CardHeader>
						<CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
							<Button asChild size="lg">
								<Link to={ctaLink}>{ctaCopy}</Link>
							</Button>
							<p className="text-sm text-muted-foreground">
								Shared theme tokens live in <code>@quickhub/ui</code> and can
								now drive future screens.
							</p>
						</CardContent>
					</Card>

					<Card className="border-border/70 bg-container text-foreground shadow-sm">
						<CardHeader>
							<CardTitle className="text-lg">Base kit</CardTitle>
							<CardDescription>
								Imported primitives ready to extend.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-3 text-sm text-muted-foreground">
							<div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-4 py-3">
								<span>Theme tokens</span>
								<Badge variant="secondary">active</Badge>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-4 py-3">
								<span>32 UI primitives</span>
								<Badge variant="secondary">shared</Badge>
							</div>
							<div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-4 py-3">
								<span>Dashboard wired</span>
								<Badge variant="secondary">validated</Badge>
							</div>
						</CardContent>
					</Card>
				</section>

				{repos.length > 0 && (
					<section className="grid gap-4">
						<div>
							<h2 className="text-xl font-semibold tracking-tight">
								Recent repositories
							</h2>
							<p className="text-sm text-muted-foreground">
								Current data rendered with the shared card, badge, and button
								language.
							</p>
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							{repos.map((repo) => (
								<Card
									key={repo.id}
									className="border-border/70 bg-background/90 shadow-sm"
								>
									<CardHeader className="gap-3">
										<div className="flex items-start justify-between gap-3">
											<div className="space-y-1">
												<CardTitle className="text-lg">
													<a
														href={repo.url}
														target="_blank"
														rel="noopener noreferrer"
														className="transition-opacity hover:opacity-70"
													>
														{repo.name}
													</a>
												</CardTitle>
												<CardDescription>
													{repo.description ??
														"A focused repository surfaced from your GitHub account."}
												</CardDescription>
											</div>
											{repo.isPrivate ? (
												<Badge variant="outline">Private</Badge>
											) : (
												<Badge variant="secondary">Public</Badge>
											)}
										</div>
									</CardHeader>
									<CardContent className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
										<div className="flex items-center gap-3">
											{repo.language ? <span>{repo.language}</span> : null}
											{repo.stars ? <span>{repo.stars} stars</span> : null}
										</div>
										<Button asChild variant="ghost" size="sm">
											<a
												href={repo.url}
												target="_blank"
												rel="noopener noreferrer"
											>
												View repo
											</a>
										</Button>
									</CardContent>
								</Card>
							))}
						</div>
					</section>
				)}
			</div>
		</main>
	);
}
