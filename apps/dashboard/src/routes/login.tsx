import { GitHubLogo } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Logo } from "@diffkit/ui/components/logo";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "#/lib/auth.functions";
import { signInWithGitHub } from "#/lib/auth-actions";
import { normalizeAuthRedirect } from "#/lib/auth-redirect";
import {
	buildSeo,
	buildSoftwareApplicationSchema,
	formatPageTitle,
} from "#/lib/seo";
import { siteConfig } from "#/lib/site-config";

export const Route = createFileRoute("/login")({
	validateSearch: (search) => ({
		redirect: normalizeAuthRedirect(search.redirect),
	}),
	beforeLoad: async ({ search }) => {
		const session = await getSession();
		if (session) throw redirect({ href: search.redirect });
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
	const { redirect } = Route.useSearch();

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
									Beta version
								</p>
							</div>
						</div>

						<div className="space-y-6">
							<div>
								<h1 className="w-full text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
									Review your GitHub work in one place
								</h1>
							</div>

							<form
								className="space-y-3"
								onSubmit={(event) => {
									event.preventDefault();
									void signInWithGitHub({ redirect });
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
						</div>

						<div className="flex items-center gap-2 text-base text-muted-foreground sm:text-sm">
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-border"
							/>
							<p>Your GitHub activity, one dashboard away.</p>
						</div>
					</div>
				</section>

				<section className="hidden min-h-dvh items-center overflow-hidden bg-background py-4 pl-4 lg:flex lg:py-6 lg:pl-6 xl:py-8 xl:pl-8">
					<div className="[-webkit-mask-image:linear-gradient(to_right,black_0,black_80%,transparent_100%)] [mask-image:linear-gradient(to_right,black_0,black_80%,transparent_100%)] flex w-[114%] shrink-0 translate-x-20 items-center justify-center rounded-[2rem] bg-background p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.3)] dark:shadow-none xl:translate-x-32">
						<img
							src="/login-preview.png"
							alt="DiffKit dashboard preview"
							className="aspect-[16/10] w-full max-w-[56rem] rounded-xl border border-border object-cover object-left-top shadow-[0_18px_40px_-34px_rgba(15,23,42,0.25)] dark:shadow-none xl:max-w-[64rem]"
						/>
					</div>
				</section>
			</div>
		</main>
	);
}
