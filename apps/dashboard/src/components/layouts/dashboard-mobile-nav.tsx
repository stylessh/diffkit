import {
	ArchiveIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	HomeIcon,
	InboxIcon,
	IssuesIcon,
	MoonIcon,
	ReviewsIcon,
	SunIcon,
	SystemIcon,
	UserCircleIcon,
} from "@diffkit/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@diffkit/ui/components/avatar";
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
import { Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { signOutToLogin } from "#/lib/auth-actions";
import { githubViewerQueryOptions } from "#/lib/github.query";
import { useHasMounted } from "#/lib/use-has-mounted";

const themeOptions = [
	{ value: "light", icon: SunIcon, label: "Light" },
	{ value: "dark", icon: MoonIcon, label: "Dark" },
	{ value: "system", icon: SystemIcon, label: "System" },
] as const;

interface MobileNavItem {
	to: string;
	label: string;
	icon: typeof HomeIcon;
	count?: number;
}

interface DashboardMobileNavProps {
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

export function DashboardMobileNav({
	user,
	tabsReady,
	counts,
}: DashboardMobileNavProps) {
	const { theme, setTheme } = useTheme();
	const hasMounted = useHasMounted();
	const viewerQuery = useQuery({
		...githubViewerQueryOptions({ userId: user.id }),
		enabled: hasMounted,
	});
	const viewerLogin = viewerQuery.data?.login;

	const displayName = user.name ?? user.email;
	const initials = displayName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	const navItems: MobileNavItem[] = [
		{ to: "/", label: "Overview", icon: HomeIcon },
		{ to: "/inbox", label: "Inbox", icon: InboxIcon },
		{ to: "/repos", label: "Repos", icon: ArchiveIcon },
		{
			to: "/pulls",
			label: "Pulls",
			icon: GitPullRequestIcon,
			count: counts.pulls,
		},
		{ to: "/issues", label: "Issues", icon: IssuesIcon, count: counts.issues },
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
	];

	return (
		<nav className="flex items-stretch border-t-[0.5px] border-header-rule bg-main md:hidden">
			{navItems.map((item) => (
				<Link
					key={item.to}
					to={item.to}
					preload={false}
					activeOptions={{ exact: true }}
					activeProps={{ className: "active" }}
					aria-label={
						typeof item.count === "number" && item.count > 0
							? `${item.label} (${item.count})`
							: item.label
					}
					className={cn(
						"relative flex flex-1 items-center justify-center py-3 text-icon-faint transition-colors",
						"[&.active]:text-foreground",
						!tabsReady && "pointer-events-none opacity-0",
					)}
				>
					<div className="relative">
						<item.icon size={20} strokeWidth={1.8} />
						{typeof item.count === "number" && item.count > 0 && (
							<span className="absolute -top-1.5 -right-3.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-nav-selected px-1 text-[10px] leading-none font-medium text-text-strong tabular-nums">
								{item.count > 99 ? "+" : item.count}
							</span>
						)}
					</div>
				</Link>
			))}

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={displayName}
						className="flex flex-1 items-center justify-center py-3 text-muted-foreground"
					>
						<Avatar className="size-6">
							<AvatarImage src={user.image ?? undefined} alt={displayName} />
							<AvatarFallback
								delayMs={user.image ? 400 : 0}
								className="text-[8px]"
							>
								{initials}
							</AvatarFallback>
						</Avatar>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" side="top" className="w-56">
					<DropdownMenuLabel className="flex items-center justify-between">
						<div>
							<p>{displayName}</p>
							<p className="font-normal text-muted-foreground">{user.email}</p>
						</div>
						<div className="flex items-center gap-0.5 rounded-md bg-group p-0.5">
							{themeOptions.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => setTheme(opt.value)}
									className={cn(
										"flex size-6 items-center justify-center rounded-sm transition-colors",
										theme === opt.value
											? "bg-tab-selected text-foreground shadow-tab-selected"
											: "text-muted-foreground hover:text-foreground",
									)}
									title={opt.label}
									aria-label={opt.label}
									aria-pressed={theme === opt.value}
								>
									<opt.icon size={13} strokeWidth={2} />
								</button>
							))}
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
							<Link to="/settings">
								Settings
								<DropdownMenuShortcut keys={["G", "S"]} />
							</Link>
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => void signOutToLogin()}>
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<div className="pb-[env(safe-area-inset-bottom)]" />
		</nav>
	);
}
