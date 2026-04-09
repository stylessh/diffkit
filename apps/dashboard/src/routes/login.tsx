import { GitHubLogo } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Logo } from "@diffkit/ui/components/logo";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "#/lib/auth.functions";
import { signInWithGitHub } from "#/lib/auth-actions";
import {
	buildSeo,
	buildSoftwareApplicationSchema,
	formatPageTitle,
} from "#/lib/seo";
import { siteConfig } from "#/lib/site-config";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const session = await getSession();
		if (session) throw redirect({ to: "/" });
	},
	head: () => {
		const seo = buildSeo({
			path: "/login",
			title: formatPageTitle(
				"GitHub dashboard for pull requests, issues, and reviews",
			),
			description:
				"Track GitHub pull requests, assigned issues, and review requests in one focused dashboard built for developers.",
		});

		return {
			links: seo.links,
			meta: seo.meta,
			scripts: [
				{
					type: "application/ld+json",
					children: JSON.stringify(
						buildSoftwareApplicationSchema(siteConfig.url),
					),
				},
			],
		};
	},
	component: LoginPage,
});

function LoginPage() {
	return (
		<main className="isolate min-h-dvh bg-background">
			<div className="grid min-h-dvh lg:grid-cols-[35fr_65fr]">
				<section className="flex min-h-dvh bg-background px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-12 xl:px-20">
					<div className="mx-auto flex w-full max-w-xs flex-1 flex-col justify-between gap-10">
						<div className="flex items-center gap-3">
							<Logo
								className="size-9 text-foreground"
								variant={import.meta.env.DEV ? "dev" : "default"}
							/>
							<div>
								<p className="text-base font-medium text-foreground sm:text-sm">
									DiffKit
								</p>
								<p className="text-base text-muted-foreground sm:text-sm">
									Review workspace
								</p>
							</div>
						</div>

						<div className="space-y-6">
							<div>
								<h1 className="w-full text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
									Review your GitHub work in one place
								</h1>
								<p className="mt-3 text-base leading-7 text-muted-foreground sm:text-sm sm:leading-6">
									DiffKit pulls together open pull requests, assigned issues,
									and pending code reviews into one fast workspace so you can
									move through GitHub work without tab sprawl.
								</p>
							</div>

							<form
								className="space-y-3"
								onSubmit={(event) => {
									event.preventDefault();
									void signInWithGitHub();
								}}
							>
								<Button
									type="submit"
									size="lg"
									iconLeft={<GitHubLogo />}
									className="h-11 w-full rounded-lg text-base sm:h-9 sm:text-[13px]"
								>
									Continue with GitHub
								</Button>
							</form>

							<div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
								<h2 className="text-sm font-medium text-foreground">
									What DiffKit helps you do
								</h2>
								<ul className="space-y-2 text-sm leading-6 text-muted-foreground">
									<li>
										Track pull requests across repositories from one queue.
									</li>
									<li>
										See assigned issues, mentions, and review requests together.
									</li>
									<li>
										Open diffs, comments, and issue details without context
										switching.
									</li>
								</ul>
							</div>
						</div>

						<div className="flex items-center gap-2 text-base text-muted-foreground sm:text-sm">
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-border"
							/>
							<p>Simple now, room to layer more later.</p>
						</div>
					</div>
				</section>

				<section className="hidden min-h-dvh items-center overflow-hidden bg-background py-4 pl-4 lg:flex lg:py-6 lg:pl-6 xl:py-8 xl:pl-8">
					<div className="[-webkit-mask-image:linear-gradient(to_right,black_0,black_80%,transparent_100%)] [mask-image:linear-gradient(to_right,black_0,black_80%,transparent_100%)] flex w-[114%] shrink-0 translate-x-20 items-center justify-center rounded-[2rem] bg-background p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.3)] dark:shadow-none xl:translate-x-32">
						<div className="flex aspect-[16/10] w-full max-w-[56rem] flex-col justify-between rounded-[1.5rem] border border-border bg-card p-8 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.25)] dark:shadow-none xl:max-w-[64rem]">
							<div className="max-w-xl space-y-4">
								<p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
									Developer workflow
								</p>
								<h2 className="text-4xl font-semibold tracking-tight text-foreground">
									A calmer way to triage PRs, issues, and review requests.
								</h2>
								<p className="max-w-lg text-base leading-7 text-muted-foreground">
									Use one dashboard for GitHub queues, detailed pull request
									views, issue threads, and code review context.
								</p>
							</div>

							<div className="grid grid-cols-3 gap-4">
								<FeaturePanel
									label="Pull Requests"
									value="Track authored, assigned, mentioned, and involved PRs."
								/>
								<FeaturePanel
									label="Issues"
									value="Monitor assigned issues, authored work, and mentions."
								/>
								<FeaturePanel
									label="Code Reviews"
									value="Review diffs, comments, and status updates in one flow."
								/>
							</div>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}

function FeaturePanel({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-border bg-background/70 p-4">
			<p className="text-sm font-medium text-foreground">{label}</p>
			<p className="mt-2 text-sm leading-6 text-muted-foreground">{value}</p>
		</div>
	);
}
