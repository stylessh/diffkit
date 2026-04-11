import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Outlet } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef } from "react";
import { getGitHubAppAccessState } from "#/lib/github.functions";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
} from "#/lib/github.query";
import { useShowOrgSetupQueryState } from "#/lib/github-access-dialog-query";
import { openGitHubAccessPrompt } from "#/lib/github-access-modal-store";
import { useGitHubRevalidation } from "#/lib/use-github-revalidation";
import { useHasMounted } from "#/lib/use-has-mounted";
import { DashboardBottomBar } from "./dashboard-bottombar";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import { DashboardTopbar } from "./dashboard-topbar";

const CommandPalette = lazy(() =>
	import("#/components/navigation/command-palette").then((mod) => ({
		default: mod.CommandPalette,
	})),
);
const GitHubAccessDialog = lazy(() =>
	import("./github-access-dialog").then((mod) => ({
		default: mod.GitHubAccessDialog,
	})),
);

const routeApi = getRouteApi("/_protected");

export function DashboardLayout() {
	const { user } = routeApi.useRouteContext();
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();
	const missingAppAuthPromptedRef = useRef(false);
	const [showOrgSetup, setShowOrgSetup] = useShowOrgSetupQueryState();
	useGitHubRevalidation(user.id);

	const githubAccessQuery = useQuery({
		queryKey: ["github-app-access-state", user.id],
		queryFn: () => getGitHubAppAccessState(),
		enabled: hasMounted,
		staleTime: 5 * 60 * 1000,
	});
	const pullsQuery = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});
	const issuesQuery = useQuery({
		...githubMyIssuesQueryOptions(scope),
		enabled: hasMounted,
	});
	const pullCount =
		hasMounted && pullsQuery.data
			? pullsQuery.data.reviewRequested.length +
				pullsQuery.data.assigned.length +
				pullsQuery.data.authored.length +
				pullsQuery.data.mentioned.length +
				pullsQuery.data.involved.length
			: undefined;
	const issueCount =
		hasMounted && issuesQuery.data
			? issuesQuery.data.assigned.length +
				issuesQuery.data.authored.length +
				issuesQuery.data.mentioned.length
			: undefined;
	const tabsReady = hasMounted && Boolean(pullsQuery.data && issuesQuery.data);

	useEffect(() => {
		if (
			!hasMounted ||
			showOrgSetup ||
			missingAppAuthPromptedRef.current ||
			!githubAccessQuery.data ||
			githubAccessQuery.data.installationsAvailable
		) {
			return;
		}

		missingAppAuthPromptedRef.current = true;
		openGitHubAccessPrompt({ source: "onboarding" });
		void setShowOrgSetup(true);
	}, [githubAccessQuery.data, hasMounted, setShowOrgSetup, showOrgSetup]);

	return (
		<div className="isolate flex h-dvh flex-col bg-muted">
			<DashboardTopbar
				user={user}
				tabsReady={tabsReady}
				counts={{
					pulls: pullCount,
					issues: issueCount,
					reviews: hasMounted
						? pullsQuery.data?.reviewRequested.length
						: undefined,
				}}
			/>
			<div className="flex flex-1 flex-col overflow-hidden p-2 pt-0">
				<div className="flex-1 overflow-hidden rounded-xl border bg-card shadow-[0_1px_4px_0_rgba(0,0,0,0.03)]">
					<div className="h-full">
						<Outlet />
					</div>
				</div>
			</div>
			<DashboardBottomBar />
			<DashboardMobileNav
				user={user}
				tabsReady={tabsReady}
				counts={{
					pulls: pullCount,
					issues: issueCount,
					reviews: hasMounted
						? pullsQuery.data?.reviewRequested.length
						: undefined,
				}}
			/>
			<Suspense>
				<CommandPalette />
				<GitHubAccessDialog userId={user.id} />
			</Suspense>
		</div>
	);
}
