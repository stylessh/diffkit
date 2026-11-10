import { AlertCircleIcon, GitHubLogo } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Callout, CalloutContent } from "@diffkit/ui/components/callout";
import { Chip } from "@diffkit/ui/components/chip";
import { Logo } from "@diffkit/ui/components/logo";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProductPreview } from "#/components/landing/product-preview";
import { getGitHubSignInMode, getSession } from "#/lib/auth.functions";
import { signInWithGitHub } from "#/lib/auth-actions";
import { normalizeAuthRedirect } from "#/lib/auth-redirect";
import { getRepositoryStars } from "#/lib/repository-stars.functions";
import {
	buildSeo,
	buildSoftwareApplicationSchema,
	formatPageTitle,
} from "#/lib/seo";
import {
	parseSignInError,
	type SignInError,
	signInErrorMessages,
} from "#/lib/sign-in-error";
import { siteConfig } from "#/lib/site-config";

export const Route = createFileRoute("/login")({
	validateSearch: (search): { redirect: string; error?: SignInError } => ({
		redirect: normalizeAuthRedirect(search.redirect),
		error: parseSignInError(search.error),
	}),
	beforeLoad: async ({ search }) => {
		const session = await getSession();
		if (session) throw redirect({ href: search.redirect });
	},
	loader: async () => {
		const [signInMode, stars] = await Promise.all([
			getGitHubSignInMode(),
			getRepositoryStars(),
		]);
		return { signInMode, stars };
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

const starCount = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
});

function LoginPage() {
	const { redirect, error } = Route.useSearch();
	const { signInMode, stars } = Route.useLoaderData();
	const signIn = () => {
		void signInWithGitHub({ redirect, mode: signInMode });
	};

	return (
		<main className="isolate flex min-h-dvh flex-col bg-background [--page-width:1080px]">
			<header className="sticky top-0 z-10 border-b-[0.5px] border-header-rule bg-background/80 backdrop-blur-xl">
				<div className="enter-0 mx-auto flex h-14 w-full max-w-(--page-width) items-center gap-2 px-5 sm:px-8">
					<Logo
						className="size-6 text-foreground"
						variant={import.meta.env.DEV ? "dev" : "default"}
					/>
					<span className="text-[15px] font-semibold tracking-tight text-foreground">
						{siteConfig.name}
					</span>
					<Chip className="ml-1">Beta</Chip>
					<nav aria-label="Site" className="ml-auto flex items-center gap-1.5">
						<a
							href={siteConfig.githubRepositoryUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={
								stars === null
									? undefined
									: `${siteConfig.name} on GitHub, ${stars} stars`
							}
							className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-text-nav transition-colors hover:bg-nav-hover hover:text-foreground"
						>
							<GitHubLogo className="size-3.5" />
							{stars === null ? (
								"GitHub"
							) : (
								<span className="tabular-nums">
									{starCount.format(stars).toLowerCase()}
								</span>
							)}
						</a>
						<Button variant="outline" size="sm" onClick={signIn}>
							Sign in
						</Button>
					</nav>
				</div>
			</header>

			<section className="mx-auto flex w-full max-w-(--page-width) flex-col items-start gap-5 px-5 pt-20 pb-8 sm:px-8 sm:pt-24 lg:flex-row lg:items-end lg:justify-between lg:gap-16 lg:pt-30">
				<h1 className="text-[28px] leading-[1.06] font-[550] tracking-[-0.03em] text-balance text-foreground sm:text-[34px] lg:text-[40px]">
					<span className="enter-1 block">Your GitHub pull requests,</span>
					<span className="enter-2 block">issues and reviews in one place</span>
				</h1>
				<div className="enter-3 flex flex-col items-start gap-3 lg:items-end">
					{error ? (
						<Callout variant="destructive" role="alert">
							<CalloutContent>
								<AlertCircleIcon size={14} strokeWidth={2} />
								{signInErrorMessages[error]}
							</CalloutContent>
						</Callout>
					) : null}
					<Button
						variant="outline"
						size="lg"
						iconLeft={<GitHubLogo />}
						className="h-10 rounded-lg bg-tab-selected px-4 text-sm shadow-tab-selected"
						onClick={signIn}
					>
						Continue with GitHub
					</Button>
				</div>
			</section>

			<div className="relative -mt-2 min-h-80 flex-1 overflow-hidden mask-b-from-65%">
				<div className="absolute inset-x-0 top-2 bottom-0 mx-auto w-full max-w-[calc(var(--page-width)*1.1)] px-5 sm:px-8">
					<ProductPreview className="enter-4 h-full min-h-[760px] [--enter-distance:32px]" />
				</div>
			</div>
		</main>
	);
}
