import {
	ArchiveIcon,
	BugIcon,
	ExternalLinkIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	HomeIcon,
	InboxIcon,
	IssuesIcon,
	LogOutIcon,
	MoreHorizontalIcon,
	ReviewsIcon,
	SettingsIcon,
	UserCircleIcon,
	XLogo,
} from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
import { Button } from "@diffkit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { DashboardTabs } from "#/components/layouts/dashboard-tabs";
import { signOutToLogin } from "#/lib/auth-actions";
import {
	githubNotificationsQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { useGlobalShortcuts } from "#/lib/shortcuts";
import { removeTab, type Tab, useTabs } from "#/lib/tab-store";
import { useHasMounted } from "#/lib/use-has-mounted";

interface DashboardTopbarProps {
	user: {
		id: string;
		name?: string | null;
		email: string;
		image?: string | null;
	};
	tabsReady: boolean;
	counts: {
		pulls?: number;
		issues?: number;
		reviews?: number;
		drafts?: number;
	};
}

type NavItem = {
	to: string;
	label: string;
	icon: typeof HomeIcon;
	count?: number;
	dot?: boolean;
};

const primaryNavRoutes = [
	"/",
	"/inbox",
	"/pulls",
	"/issues",
	"/reviews",
] as const;
const MAX_TAB_SHORTCUTS = 9;
// Off on the web, where the browser's own tabs do this job; pages still record tabs.
const SHOW_OPEN_TABS = false;

export function DashboardTopbar({
	user,
	tabsReady,
	counts,
}: DashboardTopbarProps) {
	const openTabs = useTabs();
	const hasMounted = useHasMounted();
	const viewerQuery = useQuery({
		...githubViewerQueryOptions({ userId: user.id }),
		enabled: hasMounted,
	});
	const viewerLogin = viewerQuery.data?.login;
	const notificationsQuery = useQuery({
		...githubNotificationsQueryOptions({ userId: user.id }, { all: false }),
		enabled: hasMounted,
	});
	const hasUnread = (notificationsQuery.data?.notifications?.length ?? 0) > 0;
	// Store router in a ref — only used imperatively (navigate, preload),
	// never read during render, so we avoid subscribing to state changes.
	const router = useRouter();
	const routerRef = useRef(router);
	routerRef.current = router;

	const displayName = user.name ?? user.email;
	const initials = displayName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	const navItems = useMemo<NavItem[]>(
		() => [
			{ to: "/", label: "Overview", icon: HomeIcon },
			{ to: "/inbox", label: "Inbox", icon: InboxIcon, dot: hasUnread },
			{
				to: "/pulls",
				label: "Pull Requests",
				icon: GitPullRequestIcon,
				count: counts.pulls,
			},
			{
				to: "/issues",
				label: "Issues",
				icon: IssuesIcon,
				count: counts.issues,
			},
			{
				to: "/reviews",
				label: "Reviews",
				icon: ReviewsIcon,
				count: counts.reviews,
			},
			{
				to: "/drafts",
				label: "Drafts",
				icon: GitPullRequestDraftIcon,
				count: counts.drafts,
			},
		],
		[counts.pulls, counts.issues, counts.reviews, counts.drafts, hasUnread],
	);

	useEffect(() => {
		if (!tabsReady) return;

		// Preload routes serially to avoid a burst of concurrent server function
		// RPCs that can overwhelm the Cloudflare Worker.
		let cancelled = false;
		(async () => {
			for (const to of primaryNavRoutes) {
				if (cancelled) break;
				try {
					await routerRef.current.preloadRoute({ to });
				} catch {
					// preload is best-effort
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [tabsReady]);

	function navigateToTab(tab: Tab | undefined) {
		if (!tab) return;
		void routerRef.current.navigate({ to: tab.url });
	}

	function getNeighborTab(tab: Tab | undefined) {
		if (!tab) return undefined;
		const index = openTabs.findIndex((item) => item.id === tab.id);
		if (index === -1) return undefined;
		return openTabs[index + 1] ?? openTabs[index - 1];
	}

	useGlobalShortcuts([
		...Array.from(
			{ length: Math.min(openTabs.length, MAX_TAB_SHORTCUTS) },
			(_, index) => ({
				shortcut: { code: `Digit${index + 1}`, shift: true },
				enabled: SHOW_OPEN_TABS && tabsReady,
				onTrigger: () => {
					navigateToTab(openTabs[index]);
				},
			}),
		),
		{
			shortcut: [{ key: "g" }, { key: "u" }],
			enabled: tabsReady && Boolean(viewerLogin),
			onTrigger: () => {
				void routerRef.current.navigate({
					to: "/$owner",
					params: { owner: viewerLogin ?? "" },
				});
			},
		},
		{
			shortcut: { key: "w", shift: true },
			enabled: SHOW_OPEN_TABS && tabsReady && openTabs.length > 0,
			onTrigger: () => {
				const currentPath = routerRef.current.state.location.pathname;
				const currentTab = openTabs.find((tab) => tab.url === currentPath);
				if (!currentTab) return;
				const nextTab = getNeighborTab(currentTab);
				removeTab(currentTab.id);
				void routerRef.current.navigate({ to: nextTab?.url ?? "/" });
			},
		},
		{
			shortcut: { key: "ArrowLeft", shift: true },
			enabled: SHOW_OPEN_TABS && tabsReady && openTabs.length > 1,
			onTrigger: () => {
				const currentIndex = openTabs.findIndex(
					(tab) => tab.url === routerRef.current.state.location.pathname,
				);
				const nextIndex =
					currentIndex === -1
						? openTabs.length - 1
						: (currentIndex - 1 + openTabs.length) % openTabs.length;
				navigateToTab(openTabs[nextIndex]);
			},
		},
		{
			shortcut: { key: "ArrowRight", shift: true },
			enabled: SHOW_OPEN_TABS && tabsReady && openTabs.length > 1,
			onTrigger: () => {
				const currentIndex = openTabs.findIndex(
					(tab) => tab.url === routerRef.current.state.location.pathname,
				);
				const nextIndex =
					currentIndex === -1 ? 0 : (currentIndex + 1) % openTabs.length;
				navigateToTab(openTabs[nextIndex]);
			},
		},
	]);

	return (
		<nav
			className={cn(
				"flex h-12 min-w-0 shrink-0 items-center gap-3 overflow-hidden px-3 max-md:h-11 max-md:border-b-[0.5px] max-md:border-header-rule",
				!SHOW_OPEN_TABS && "max-md:hidden",
			)}
		>
			<div className="hidden md:block">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							aria-label="Account menu"
							className="flex size-8 items-center justify-center rounded-full hover:bg-nav-hover"
						>
							<Avatar className="size-6">
								<AvatarImage src={user.image ?? undefined} alt={displayName} />
								<AvatarFallback
									delayMs={user.image ? 400 : 0}
									className="text-xs"
								>
									{initials}
								</AvatarFallback>
							</Avatar>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-56">
						<DropdownMenuLabel className="flex items-center gap-3 py-2">
							<Avatar className="size-8">
								<AvatarImage src={user.image ?? undefined} alt={displayName} />
								<AvatarFallback
									delayMs={user.image ? 400 : 0}
									className="text-xs"
								>
									{initials}
								</AvatarFallback>
							</Avatar>
							<div className="flex flex-col">
								<span className="text-sm font-medium text-foreground">
									{displayName}
								</span>
								{viewerLogin && (
									<span className="text-xs font-normal text-muted-foreground">
										@{viewerLogin}
									</span>
								)}
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem asChild disabled={!viewerLogin}>
								<Link to="/$owner" params={{ owner: viewerLogin ?? "" }}>
									<UserCircleIcon size={16} strokeWidth={2} />
									Profile
									<DropdownMenuShortcut keys={["G", "U"]} />
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/repos">
									<ArchiveIcon size={16} strokeWidth={2} />
									Repositories
									<DropdownMenuShortcut keys={["G", "O"]} />
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to="/settings">
									<SettingsIcon size={16} strokeWidth={2} />
									Settings
									<DropdownMenuShortcut keys={["G", "S"]} />
								</Link>
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() => {
								void signOutToLogin();
							}}
						>
							<LogOutIcon size={16} strokeWidth={2} />
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div
				aria-hidden={!tabsReady}
				className={`hidden shrink-0 items-center gap-0.5 transition-opacity duration-150 md:flex ${
					tabsReady ? "opacity-100" : "pointer-events-none opacity-0"
				}`}
			>
				{navItems.map((item) => (
					<Button
						key={item.label}
						variant="ghost"
						size="sm"
						asChild
						iconLeft={<item.icon size={14} strokeWidth={2} />}
						className="h-7 rounded-lg px-2.5 text-text-nav hover:bg-nav-hover hover:text-foreground [&.active]:bg-nav-selected [&.active]:text-foreground"
					>
						<Link
							to={item.to as string}
							preload={false}
							activeOptions={{ exact: true }}
							activeProps={{ className: "active" }}
						>
							<span className="flex items-center gap-2">
								<span>{item.label}</span>
								{item.dot ? (
									<>
										<span
											aria-hidden
											className="size-1.5 rounded-full bg-indigo"
										/>
										<span className="sr-only">Unread</span>
									</>
								) : typeof item.count === "number" ? (
									<span
										data-slot="tab-count"
										className="text-xs tabular-nums text-muted-foreground"
									>
										{item.count}
									</span>
								) : null}
							</span>
						</Link>
					</Button>
				))}
			</div>

			<div className="min-w-0 flex-1 overflow-hidden">
				{SHOW_OPEN_TABS ? (
					<DashboardTabs tabsReady={tabsReady} routerRef={routerRef} />
				) : null}
			</div>

			<div className="hidden shrink-0 md:block">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							iconLeft={
								<MoreHorizontalIcon className="size-4" strokeWidth={2} />
							}
							className="size-7 text-text-nav hover:bg-nav-hover hover:text-foreground"
							aria-label="More actions"
						/>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-48">
						<DropdownMenuItem asChild>
							<Link
								to="/$owner/$repo"
								params={{ owner: "stylessh", repo: "diffkit" }}
							>
								<ExternalLinkIcon size={16} strokeWidth={2} />
								View GitHub repo
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link
								to="/$owner/$repo/issues/new"
								params={{ owner: "stylessh", repo: "diffkit" }}
							>
								<BugIcon size={16} strokeWidth={2} />
								Report an issue
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<a
								href="https://x.com/stylesshDev"
								target="_blank"
								rel="noopener noreferrer"
							>
								<XLogo className="size-3.5" />
								Check for updates
							</a>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</nav>
	);
}
