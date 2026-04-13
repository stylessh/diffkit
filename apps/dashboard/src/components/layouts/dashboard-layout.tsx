import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Outlet } from "@tanstack/react-router";
import { motion } from "motion/react";
import { lazy, Suspense, useEffect } from "react";
import {
	githubMyIssuesQueryOptions,
	githubMyPullsQueryOptions,
} from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useMediaQuery } from "#/lib/use-media-query";
import {
	surfaceForbiddenOrgWarnings,
	surfaceTimeoutWarning,
} from "#/lib/warning-store";
import { DashboardBottomBar } from "./dashboard-bottombar";
import { DashboardMobileNav } from "./dashboard-mobile-nav";
import {
	SIDE_PANEL_WIDTH,
	SidePanelProvider,
	SidePanelSlot,
	SidePanelToggle,
	useSidePanelSlot,
} from "./dashboard-side-panel";
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
	const tabsReady = hasMounted && Boolean(pullsQuery.data && issuesQuery.data);

	const sidePanel = useSidePanelSlot();
	const isXl = useMediaQuery("(min-width: 1280px)");
	const showPanel = isXl && sidePanel.hasContent && !sidePanel.collapsed;

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
					className="grid flex-1 overflow-hidden p-2 pt-0"
				>
					<div className="relative overflow-hidden rounded-xl border bg-card shadow-[0_1px_4px_0_rgba(0,0,0,0.03)]">
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
				<AlphaNoticeDialog />
				<GitHubAccessDialog userId={user.id} />
			</Suspense>
		</div>
	);
}
