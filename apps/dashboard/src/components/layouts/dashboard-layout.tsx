import { SideSheet, SideSheetContent } from "@diffkit/ui/components/side-sheet";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	getRouteApi,
	Outlet,
	useLocation,
	useRouter,
} from "@tanstack/react-router";
import { motion } from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AppSidebar } from "#/components/shell/app-sidebar";
import { MobileShellBar } from "#/components/shell/mobile-shell-bar";
import { SidebarToggleButton } from "#/components/shell/sidebar-toggle-button";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
} from "#/lib/github.query";
import { writeSidebarLayout } from "#/lib/shell/sidebar-layout";
import { useRecordRecentRepo } from "#/lib/shell/use-shell-actions";
import { useShellShortcuts } from "#/lib/shell/use-shell-shortcuts";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useMediaQuery } from "#/lib/use-media-query";
import { useReviewDraftCount } from "#/lib/use-review-draft-count";
import {
	surfaceForbiddenOrgWarnings,
	surfaceTimeoutWarning,
} from "#/lib/warning-store";
import { DashboardBottomBar } from "./dashboard-bottombar";
import {
	SIDE_PANEL_WIDTH,
	SidePanelProvider,
	SidePanelSlot,
	SidePanelToggle,
	useSidePanelSlot,
} from "./dashboard-side-panel";

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
	const { user, sidebarLayout: initialSidebarLayout } =
		routeApi.useRouteContext();
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
	const draftCount = useReviewDraftCount(user.id);

	const counts = {
		pulls: pullCount,
		issues: issueCount,
		reviews: hasMounted ? pullsQuery.data?.reviewRequested.length : undefined,
		drafts: draftCount,
	};
	usePreloadPrimaryRoutes(countsReady);
	useRecordRecentRepo(user.id);

	const [sidebarLayout, setSidebarLayout] = useState(initialSidebarLayout);
	const toggleSidebar = () => {
		const next = sidebarLayout === "expanded" ? "collapsed" : "expanded";
		writeSidebarLayout(next);
		setSidebarLayout(next);
	};
	useShellShortcuts({ userId: user.id, onToggleSidebar: toggleSidebar });

	const locationHref = useLocation({ select: (location) => location.href });
	const [sheetOpenedAt, setSheetOpenedAt] = useState<string | null>(null);
	const sheetOpen = sheetOpenedAt === locationHref;

	const sidePanel = useSidePanelSlot();
	const isXl = useMediaQuery("(min-width: 1280px)");
	const showPanel = isXl && sidePanel.hasContent && !sidePanel.collapsed;

	return (
		<div className="isolate flex h-dvh bg-shell">
			<div
				className={cn(
					"hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-out md:block",
					sidebarLayout === "expanded" ? "w-[244px]" : "w-[52px]",
				)}
			>
				<AppSidebar
					user={user}
					counts={counts}
					density={sidebarLayout === "expanded" ? "full" : "rail"}
					footerAction={
						<SidebarToggleButton
							layout={sidebarLayout}
							onToggle={toggleSidebar}
						/>
					}
				/>
			</div>

			<div className="flex min-w-0 flex-1 flex-col">
				<MobileShellBar onOpenSidebar={() => setSheetOpenedAt(locationHref)} />
				<SidePanelProvider
					value={{
						node: sidePanel.node,
						collapsed: sidePanel.collapsed,
						hasContent: sidePanel.hasContent,
						toggle: sidePanel.toggle,
					}}
				>
					<motion.div
						initial={false}
						animate={{
							gridTemplateColumns: showPanel
								? `minmax(0, 1fr) ${SIDE_PANEL_WIDTH}px`
								: "minmax(0, 1fr) 0px",
						}}
						transition={{ type: "spring", stiffness: 400, damping: 35 }}
						className="grid flex-1 overflow-hidden md:py-2 md:pr-2"
					>
						<div className="relative overflow-hidden bg-main md:rounded-xl md:shadow-main">
							<div className="h-full">
								<Outlet />
							</div>
							<SidePanelToggle />
						</div>

						<SidePanelSlot
							slotRef={sidePanel.setNode}
							collapsed={sidePanel.collapsed}
							onHasContent={sidePanel.setHasContent}
						/>
					</motion.div>
				</SidePanelProvider>
				<DashboardBottomBar />
			</div>

			<SideSheet
				open={sheetOpen}
				onOpenChange={(open) => setSheetOpenedAt(open ? locationHref : null)}
			>
				<SideSheetContent title="Navigation" className="md:hidden">
					<AppSidebar user={user} counts={counts} density="full" />
				</SideSheetContent>
			</SideSheet>

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
	const routerRef = useRef(router);
	routerRef.current = router;

	useEffect(() => {
		if (!ready) return;
		// Serial on purpose: a burst of concurrent server-function RPCs can overwhelm the Worker.
		let cancelled = false;
		(async () => {
			for (const to of primaryNavRoutes) {
				if (cancelled) break;
				try {
					await routerRef.current.preloadRoute({ to });
				} catch {}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [ready]);
}
