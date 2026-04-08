import {
	CloseIcon,
	GitPullRequestIcon,
	HomeIcon,
	IssuesIcon,
	MoonIcon,
	MoreHorizontalIcon,
	ReviewsIcon,
	SunIcon,
	SystemIcon,
} from "@quickhub/icons";
import { Avatar, AvatarFallback } from "@quickhub/ui/components/avatar";
import { Button } from "@quickhub/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@quickhub/ui/components/dropdown-menu";
import { Link, useRouter } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOutToLogin } from "#/lib/auth-actions";
import { preloadRouteOnce } from "#/lib/route-preload";
import { removeTab, type Tab, useTabs } from "#/lib/tab-store";

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

const tabIconMap = {
	pull: GitPullRequestIcon,
	issue: IssuesIcon,
	review: ReviewsIcon,
} as const;

const primaryNavRoutes = ["/", "/pulls", "/issues", "/reviews"] as const;

export function DashboardTopbar({
	user,
	tabsReady,
	counts,
}: DashboardTopbarProps) {
	const { theme, setTheme } = useTheme();
	const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
	const openTabs = useTabs();
	const router = useRouter();
	const scrollRef = useRef<HTMLDivElement>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	const updateScrollState = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setCanScrollLeft(el.scrollLeft > 0);
		setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const ro = new ResizeObserver(updateScrollState);
		ro.observe(el);
		return () => ro.disconnect();
	}, [updateScrollState]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el || openTabs.length === 0) return;
		el.scrollLeft = el.scrollWidth;
		updateScrollState();
	}, [openTabs.length, updateScrollState]);

	const displayName = user.name ?? user.email;
	const initials = displayName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	const navItems: NavItem[] = [
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
	];

	useEffect(() => {
		if (!tabsReady) return;

		void Promise.allSettled(
			primaryNavRoutes.map((to) => router.preloadRoute({ to })),
		);
	}, [router, tabsReady]);

	useEffect(() => {
		if (!tabsReady || openTabs.length === 0) return;

		void Promise.allSettled(
			openTabs.map((tab) => preloadRouteOnce(router, tab.url)),
		);
	}, [router, tabsReady, openTabs]);

	return (
		<nav className="flex min-w-0 items-center gap-3 overflow-hidden px-3 py-2">
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
								<AvatarFallback className="text-xs">{initials}</AvatarFallback>
							)}
						</Avatar>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-56">
					<DropdownMenuLabel className="flex items-center justify-between">
						<div>
							<p>{displayName}</p>
							<p className="font-normal text-muted-foreground">{user.email}</p>
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

			<div
				aria-hidden={!tabsReady}
				className={`shrink-0 items-center gap-0.5 transition-[opacity,transform] duration-300 ease-out ${
					tabsReady
						? "flex translate-y-0 opacity-100"
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
				{openTabs.length > 0 && (
					<div
						aria-hidden={!tabsReady}
						className={`flex min-w-0 items-center gap-3 overflow-hidden transition-[opacity,transform] duration-300 ease-out ${
							tabsReady
								? "translate-y-0 opacity-100"
								: "pointer-events-none -translate-y-0.5 opacity-0"
						}`}
					>
						<div className="h-4 shrink-0 border-l border-border/50" />
						<div className="relative min-w-0 flex-1 overflow-hidden">
							<div
								className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-muted to-transparent transition-opacity ${canScrollLeft ? "opacity-100" : "opacity-0"}`}
							/>
							<div
								className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-muted to-transparent transition-opacity ${canScrollRight ? "opacity-100" : "opacity-0"}`}
							/>
							{/* biome-ignore lint/a11y/noStaticElementInteractions: scroll container needs onScroll for gradient visibility */}
							<div
								ref={scrollRef}
								onScroll={updateScrollState}
								onMouseEnter={updateScrollState}
								className="no-scrollbar flex w-0 min-w-full items-center gap-0.5 overflow-x-auto"
							>
								{openTabs.map((tab) => {
									const Icon = tabIconMap[tab.type];
									return (
										<DetailTab
											key={tab.id}
											tab={tab}
											icon={Icon}
											onClose={(id) => {
												const isActive =
													router.state.location.pathname === tab.url;
												removeTab(id);
												if (isActive) {
													void router.navigate({ to: "/" });
												}
											}}
										/>
									);
								})}
							</div>
						</div>
					</div>
				)}
			</div>

			<div className="shrink-0">
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

function DetailTab({
	tab,
	icon: Icon,
	onClose,
}: {
	tab: Tab;
	icon: typeof GitPullRequestIcon;
	onClose: (id: string) => void;
}) {
	const router = useRouter();
	const preloadTab = () => {
		void preloadRouteOnce(router, tab.url);
	};

	return (
		<Link
			to={tab.url}
			preload={false}
			onMouseEnter={preloadTab}
			onFocus={preloadTab}
			onTouchStart={preloadTab}
			activeOptions={{ exact: true }}
			activeProps={{ className: "active" }}
			className="group relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground [&.active]:bg-surface-1 [&.active]:text-foreground"
		>
			<Icon size={13} strokeWidth={2} className={`shrink-0 ${tab.iconColor}`} />
			<span className="max-w-32 truncate">{tab.title}</span>
			{tab.type === "review" ? (
				<span className="flex items-center gap-1 font-mono text-[11px] font-medium tabular-nums">
					{tab.additions != null && (
						<span className="text-green-500">+{tab.additions}</span>
					)}
					{tab.deletions != null && (
						<span className="text-red-500">-{tab.deletions}</span>
					)}
				</span>
			) : (
				<span className="tabular-nums text-muted-foreground text-[11px]">
					#{tab.number}
				</span>
			)}
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onClose(tab.id);
				}}
				className="absolute inset-y-0 right-0 flex items-center rounded-r-md bg-surface-1 pl-1.5 pr-1.5 opacity-0 transition-opacity group-hover:opacity-100"
				aria-label={`Close ${tab.title}`}
			>
				<span className="absolute inset-y-0 -left-3 w-3 bg-gradient-to-r from-transparent to-surface-1" />
				<span className="relative flex size-4 items-center justify-center rounded-sm hover:bg-border/50">
					<CloseIcon size={10} strokeWidth={2} />
				</span>
			</button>
		</Link>
	);
}
