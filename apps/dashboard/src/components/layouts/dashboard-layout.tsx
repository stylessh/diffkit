import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Outlet, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { AppTopbar, MobileTopbar } from "#/components/shell/app-topbar";
import {
	MobileNavBar,
	workspaceNavItems,
} from "#/components/shell/workspace-nav";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
	githubNotificationsQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { useRecordRecentRepo } from "#/lib/shell/use-shell-actions";
import { useShellShortcuts } from "#/lib/shell/use-shell-shortcuts";
import { useHasMounted } from "#/lib/use-has-mounted";
import {
	surfaceForbiddenOrgWarnings,
	surfaceTimeoutWarning,
} from "#/lib/warning-store";
import { DashboardBottomBar } from "./dashboard-bottombar";

const CommandPalette = lazy(() =>
	import("#/components/navigation/command-palette").then((mod) => ({
		default: mod.CommandPalette,
	})),
);
const RepoPickerDialog = lazy(() =>
	import("#/components/shell/repo-picker-dialog").then((mod) => ({
		default: mod.RepoPickerDialog,
	})),
);
const GitHubAccessDialog = lazy(() =>
	import("./github-access-dialog").then((mod) => ({
		default: mod.GitHubAccessDialog,
	})),
);
const AlphaNoticeDialog = lazy(() =>
	import("./alpha-notice-dialog").then((mod) => ({
		default: mod.AlphaNoticeDialog,
	})),
);

const routeApi = getRouteApi("/_protected");

export function DashboardLayout() {
	const { user } = routeApi.useRouteContext();
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	const pullsQuery = useQuery({
		...githubMyPullsQueryOptions(scope),
		enabled: hasMounted,
	});
	const issuesQuery = useQuery({
		...githubMyIssuesQueryOptions(scope),
		enabled: hasMounted,
	});
	const viewerQuery = useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});
	const notificationsQuery = useQuery({
		...githubNotificationsQueryOptions(scope, { all: false }),
		enabled: hasMounted,
	});
	useEffect(() => {
		surfaceForbiddenOrgWarnings(pullsQuery.data?.forbiddenOrgs);
	}, [pullsQuery.data?.forbiddenOrgs]);
	useEffect(() => {
		surfaceForbiddenOrgWarnings(issuesQuery.data?.forbiddenOrgs);
	}, [issuesQuery.data?.forbiddenOrgs]);
	useEffect(() => {
		surfaceTimeoutWarning(
			pullsQuery.data?.timedOut || issuesQuery.data?.timedOut,
		);
	}, [pullsQuery.data?.timedOut, issuesQuery.data?.timedOut]);

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
	const countsReady =
		hasMounted && Boolean(pullsQuery.data && issuesQuery.data);

	const counts = {
		pulls: pullCount,
		issues: issueCount,
		reviews: hasMounted ? pullsQuery.data?.reviewRequested.length : undefined,
	};
	usePreloadPrimaryRoutes(countsReady);
	useRecordRecentRepo(user.id);

	useShellShortcuts({ userId: user.id });

	const hasUnread = (notificationsQuery.data?.notifications?.length ?? 0) > 0;
	const navItems = workspaceNavItems(counts, hasUnread);
	const viewerLogin = viewerQuery.data?.login;

	return (
		<div className="isolate flex h-dvh flex-col bg-shell" data-app-shell>
			<AppTopbar user={user} viewerLogin={viewerLogin} navItems={navItems} />
			<MobileTopbar user={user} viewerLogin={viewerLogin} />
			<div className="flex flex-1 overflow-hidden pt-px md:px-2 md:pt-0.5 md:pb-2">
				<div className="relative min-w-0 flex-1 overflow-hidden rounded-t-xl bg-main shadow-main md:rounded-xl">
					<div className="h-full">
						<Outlet />
					</div>
				</div>
			</div>
			<DashboardBottomBar />
			<MobileNavBar items={navItems} />

			<Suspense>
				<CommandPalette />
				<RepoPickerDialog />
				<AlphaNoticeDialog />
				<GitHubAccessDialog userId={user.id} />
			</Suspense>
		</div>
	);
}

const primaryNavRoutes = [
	"/",
	"/inbox",
	"/pulls",
	"/issues",
	"/reviews",
] as const;

function usePreloadPrimaryRoutes(ready: boolean) {
	const router = useRouter();

	useEffect(() => {
		if (!ready) return;
		// Serial on purpose: a burst of concurrent server-function RPCs can overwhelm the Worker.
		let cancelled = false;
		(async () => {
			for (const to of primaryNavRoutes) {
				if (cancelled) break;
				try {
					await router.preloadRoute({ to });
				} catch {}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [ready, router]);
}
