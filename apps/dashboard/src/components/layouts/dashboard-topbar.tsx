import {
	GitPullRequestIcon,
	HomeIcon,
	IssuesIcon,
	MoonIcon,
	MoreHorizontalIcon,
	ReviewsIcon,
	SunIcon,
	SystemIcon,
} from "@diffkit/icons";
import { Avatar, AvatarFallback } from "@diffkit/ui/components/avatar";
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
import { Link, useRouter } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardTabs } from "#/components/layouts/dashboard-tabs";
import { signOutToLogin } from "#/lib/auth-actions";
import { useGlobalShortcuts } from "#/lib/shortcuts";
import { type Tab, useTabs } from "#/lib/tab-store";

interface DashboardTopbarProps {
	user: {
		name?: string | null;
		email: string;
		image?: string | null;
	};
	tabsReady: boolean;
	counts: {
		pulls?: number;
		issues?: number;
		reviews?: number;
	};
}

type NavItem = {
	to: string;
	label: string;
	icon: typeof HomeIcon;
	count?: number;
};

const themeOptions = [
	{ value: "light", icon: SunIcon, label: "Light" },
	{ value: "dark", icon: MoonIcon, label: "Dark" },
	{ value: "system", icon: SystemIcon, label: "System" },
] as const;

const primaryNavRoutes = ["/", "/pulls", "/issues", "/reviews"] as const;
const MAX_TAB_SHORTCUTS = 9;

export function DashboardTopbar({
	user,
	tabsReady,
	counts,
}: DashboardTopbarProps) {
	const { theme, setTheme } = useTheme();
	const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
	const openTabs = useTabs();
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
		],
		[counts.pulls, counts.issues, counts.reviews],
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

	useGlobalShortcuts([
		...Array.from(
			{ length: Math.min(openTabs.length, MAX_TAB_SHORTCUTS) },
			(_, index) => ({
				shortcut: { code: `Digit${index + 1}`, shift: true },
				enabled: tabsReady,
				onTrigger: () => {
					navigateToTab(openTabs[index]);
				},
			}),
		),
		{
			shortcut: { key: "ArrowLeft", shift: true },
			enabled: tabsReady && openTabs.length > 1,
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
			enabled: tabsReady && openTabs.length > 1,
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
		<nav className="flex min-w-0 items-center gap-3 overflow-hidden px-3 py-2">
			<div className="hidden md:block">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex size-8 items-center justify-center rounded-full"
						>
							<Avatar className="size-7 border border-border">
								{user.image && !avatarLoadFailed ? (
									<img
										src={user.image}
										alt={displayName}
										className="size-full object-cover"
										onError={() => {
											setAvatarLoadFailed(true);
										}}
									/>
								) : (
									<AvatarFallback className="text-xs">
										{initials}
									</AvatarFallback>
								)}
							</Avatar>
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-56">
						<DropdownMenuLabel className="flex items-center justify-between">
							<div>
								<p>{displayName}</p>
								<p className="font-normal text-muted-foreground">
									{user.email}
								</p>
							</div>
							<div className="flex items-center gap-0.5 rounded-md border border-border/50 p-0.5">
								{themeOptions.map((opt) => (
									<button
										key={opt.value}
										type="button"
										onClick={() => setTheme(opt.value)}
										className={`flex size-6 items-center justify-center rounded-sm transition-colors ${
											theme === opt.value
												? "bg-surface-1 text-foreground"
												: "text-muted-foreground hover:text-foreground"
										}`}
										title={opt.label}
									>
										<opt.icon size={13} strokeWidth={2} />
									</button>
								))}
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								Profile
								<DropdownMenuShortcut keys={["G", "P"]} />
							</DropdownMenuItem>
							<DropdownMenuItem>
								Settings
								<DropdownMenuShortcut keys={["G", "S"]} />
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() => {
								void signOutToLogin();
							}}
						>
							Sign out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div
				aria-hidden={!tabsReady}
				className={`hidden shrink-0 items-center gap-0.5 transition-[opacity,transform] duration-300 ease-out md:flex ${
					tabsReady
						? "translate-y-0 opacity-100"
						: "pointer-events-none -translate-y-0.5 opacity-0"
				}`}
			>
				{navItems.map((item) => (
					<Button
						key={item.label}
						variant="ghost"
						size="sm"
						asChild
						iconLeft={<item.icon size={15} strokeWidth={2} />}
						className="text-muted-foreground [&.active]:bg-surface-1 [&.active]:text-foreground"
					>
						<Link
							to={item.to as string}
							preload={false}
							activeOptions={{ exact: true }}
							activeProps={{ className: "active" }}
						>
							<span className="flex items-center gap-2">
								<span>{item.label}</span>
								{typeof item.count === "number" ? (
									<span
										data-slot="tab-count"
										className="tabular-nums text-muted-foreground"
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
				<DashboardTabs tabsReady={tabsReady} routerRef={routerRef} />
			</div>

			<div className="hidden shrink-0 md:block">
				<Button
					variant="ghost"
					size="icon"
					iconLeft={<MoreHorizontalIcon className="size-5" strokeWidth={2} />}
					className="size-8 text-muted-foreground hover:bg-surface-1"
					aria-label="More actions"
				/>
			</div>
		</nav>
	);
}
