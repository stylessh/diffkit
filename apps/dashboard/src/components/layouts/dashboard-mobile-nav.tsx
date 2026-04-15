import {
	GitPullRequestIcon,
	HomeIcon,
	InboxIcon,
	IssuesIcon,
	MoonIcon,
	ReviewsIcon,
	SunIcon,
	SystemIcon,
} from "@diffkit/icons";
import { Avatar, AvatarFallback } from "@diffkit/ui/components/avatar";
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
import { Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useState } from "react";
import { signOutToLogin } from "#/lib/auth-actions";

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

export function DashboardMobileNav({
	user,
	tabsReady,
	counts,
}: DashboardMobileNavProps) {
	const { theme, setTheme } = useTheme();
	const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

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
	];

	return (
		<nav className="flex items-stretch border-t border-border bg-card md:hidden">
			{navItems.map((item) => (
				<Link
					key={item.to}
					to={item.to}
					preload={false}
					activeOptions={{ exact: true }}
					activeProps={{ className: "active" }}
					className={cn(
						"relative flex flex-1 items-center justify-center py-3 text-muted-foreground transition-colors",
						"[&.active]:bg-surface-1 [&.active]:text-foreground",
						!tabsReady && "pointer-events-none opacity-0",
					)}
				>
					<div className="relative">
						<item.icon size={22} strokeWidth={1.8} />
						{typeof item.count === "number" && item.count > 0 && (
							<span className="absolute -right-4 -top-1.5 flex size-4 items-center justify-center rounded-full bg-border text-[9px] font-medium leading-none text-muted-foreground tabular-nums">
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
						className="flex flex-1 items-center justify-center py-3 text-muted-foreground"
					>
						<Avatar className="size-6 border border-border">
							{user.image && !avatarLoadFailed ? (
								<img
									src={user.image}
									alt={displayName}
									className="size-full object-cover"
									onError={() => setAvatarLoadFailed(true)}
								/>
							) : (
								<AvatarFallback className="text-[8px]">
									{initials}
								</AvatarFallback>
							)}
						</Avatar>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" side="top" className="w-56">
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
									className={cn(
										"flex size-6 items-center justify-center rounded-sm transition-colors",
										theme === opt.value
											? "bg-surface-1 text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
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
