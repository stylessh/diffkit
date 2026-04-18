import { Button } from "@diffkit/ui/components/button";
import { Logo } from "@diffkit/ui/components/logo";
import { Spinner } from "@diffkit/ui/components/spinner";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getSession } from "#/lib/auth.functions";
import { getGitHubAppAccessState } from "#/lib/github.functions";
import {
	buildGitHubAppAuthorizePath,
	findInstallationForOwner,
	type GitHubAppAccessState,
	getAccessHrefForOwner,
} from "#/lib/github-access";
import { buildSeo, formatPageTitle, PRIVATE_ROUTE_HEADERS } from "#/lib/seo";
import { useRefreshOnReturn } from "#/lib/use-refresh-on-return";

function SetupPageLoading() {
	return (
		<main className="isolate min-h-dvh bg-background">
			<div className="flex min-h-dvh items-center justify-center">
				<Spinner size={20} className="text-muted-foreground" />
			</div>
		</main>
	);
}

export const Route = createFileRoute("/setup")({
	pendingComponent: SetupPageLoading,
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/login", search: { redirect: "/setup" } });
		}

		return { user: session.user };
	},
	loader: async () => {
		const accessState = await getGitHubAppAccessState().catch(() => null);
		return { accessState };
	},
	headers: () => PRIVATE_ROUTE_HEADERS,
	head: ({ match }) =>
		buildSeo({
			path: match.pathname,
			title: formatPageTitle("Setup"),
			description: "Configure GitHub access for DiffKit.",
			robots: "noindex",
		}),
	component: SetupPage,
});

function SetupPage() {
	const { accessState: state } = Route.useLoaderData();
	useRefreshOnReturn();

	const hasInstallations =
		state?.installationsAvailable === true &&
		(state.personalInstallation != null || state.orgInstallations.length > 0);
	const allInstalled =
		hasInstallations &&
		state.personalInstallation != null &&
		state.missingOrganizations.length === 0;
	const needsAppAuthorization =
		state != null && state.installationsAvailable === false;
	const primaryHref = allInstalled
		? null
		: needsAppAuthorization
			? (state.appAuthorizationUrl ?? buildGitHubAppAuthorizePath("/setup"))
			: (state?.publicInstallUrl ?? null);

	return (
		<main className="isolate min-h-dvh bg-background">
			<div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-12">
				<div className="flex w-full flex-col gap-8">
					<div className="flex flex-col items-center gap-3">
						<Logo
							className="size-10 text-foreground"
							variant={import.meta.env.DEV ? "dev" : "default"}
						/>
						<div className="text-center">
							<h1 className="text-xl font-semibold tracking-tight text-foreground">
								Connect your GitHub
							</h1>
							<p className="mt-1.5 text-sm text-muted-foreground">
								DiffKit needs access to your repositories to get started.
							</p>
						</div>
					</div>

					<div className="flex w-full flex-col gap-4">
						{state ? (
							<SetupAccessList state={state} />
						) : (
							<div className="rounded-xl border border-border/70 px-4 py-10">
								<p className="text-center text-sm text-muted-foreground">
									Could not load installation status. Please authorize the app
									to continue.
								</p>
							</div>
						)}
						<div className="flex flex-col gap-1.5">
							{primaryHref ? (
								<Button asChild size="default" className="w-full">
									<a href={primaryHref}>
										{needsAppAuthorization
											? "Authorize app"
											: "Install on GitHub"}
									</a>
								</Button>
							) : !state ? (
								<Button asChild size="default" className="w-full">
									<a href={buildGitHubAppAuthorizePath("/setup")}>
										Authorize app
									</a>
								</Button>
							) : null}
							{hasInstallations ? (
								<Button
									asChild
									variant="ghost"
									size="default"
									className="w-full"
								>
									<Link to="/">Go to dashboard</Link>
								</Button>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}

function SetupAccessList({ state }: { state: GitHubAppAccessState }) {
	const canDetect = state.installationsAvailable;

	const targets = [
		{
			login: state.viewerLogin,
			type: "personal" as const,
			status: canDetect
				? state.personalInstallation
					? ("installed" as const)
					: ("not-installed" as const)
				: ("unknown" as const),
			scope: state.personalInstallation
				? state.personalInstallation.repositorySelection === "selected"
					? ("selected" as const)
					: ("all" as const)
				: null,
			href: getAccessHrefForOwner(state, state.viewerLogin),
		},
		...state.organizations.map((org) => {
			const installation = findInstallationForOwner(state, org.login);
			return {
				login: org.login,
				type: "org" as const,
				status: canDetect
					? installation
						? ("installed" as const)
						: ("not-installed" as const)
					: ("unknown" as const),
				scope: installation
					? installation.repositorySelection === "selected"
						? ("selected" as const)
						: ("all" as const)
					: null,
				href: getAccessHrefForOwner(state, org.login),
			};
		}),
	];

	return (
		<ul className="overflow-hidden rounded-xl border border-border/70">
			{targets.map((target) => (
				<li
					key={target.login}
					className="flex items-center gap-3 px-3.5 py-2.5 not-first:border-t not-first:border-border/70"
				>
					<div
						className={
							"flex size-2 shrink-0 rounded-full " +
							(target.status === "installed"
								? "bg-green-500"
								: target.status === "not-installed"
									? "bg-yellow-500"
									: "bg-muted-foreground/40")
						}
					/>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{target.login}</p>
						<p className="text-xs text-muted-foreground">
							{target.status === "installed"
								? target.scope === "selected"
									? "Installed · selected repositories"
									: "Installed"
								: target.status === "not-installed"
									? "Not installed"
									: "Authorize app to check status"}
							{target.type === "personal" ? " · personal" : " · org"}
						</p>
					</div>
					{target.href ? (
						<Button
							asChild
							variant={target.status === "installed" ? "secondary" : "outline"}
							size="xs"
							className="shrink-0"
						>
							<a
								href={target.href}
								{...(target.href.startsWith("http")
									? { target: "_blank", rel: "noopener noreferrer" }
									: {})}
							>
								{target.status === "installed"
									? "Manage"
									: target.status === "unknown"
										? "Authorize"
										: "Configure"}
							</a>
						</Button>
					) : null}
				</li>
			))}
			{targets.length === 1 && (
				<li className="border-t border-border/70 px-3.5 py-6">
					<p className="text-center text-xs text-muted-foreground">
						No organizations detected on this account.
					</p>
				</li>
			)}
		</ul>
	);
}
