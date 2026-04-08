import {
	GitPullRequestIcon,
	HomeIcon,
	IssuesIcon,
	MoonIcon,
	MoreHorizontalIcon,
	ReviewsIcon,
	SunIcon,
	SystemIcon,
} from "@quickhub/icons";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@quickhub/ui/components/avatar";
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
import { Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { signOutToLogin } from "#/lib/auth-actions";

interface DashboardTopbarProps {
	user: {
		name?: string | null;
		email: string;
		image?: string | null;
	};
}

const navItems = [
	{ to: "/", label: "Overview", icon: HomeIcon },
	{ to: "/pull-requests", label: "Pull Requests", icon: GitPullRequestIcon },
	{ to: "/issues", label: "Issues", icon: IssuesIcon },
	{ to: "/reviews", label: "Reviews", icon: ReviewsIcon },
] as const;

const themeOptions = [
	{ value: "light", icon: SunIcon, label: "Light" },
	{ value: "dark", icon: MoonIcon, label: "Dark" },
	{ value: "system", icon: SystemIcon, label: "System" },
] as const;

export function DashboardTopbar({ user }: DashboardTopbarProps) {
	const { theme, setTheme } = useTheme();
	const displayName = user.name ?? user.email;
	const initials = displayName
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<nav className="flex items-center gap-3 px-3 py-2">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex size-8 items-center justify-center rounded-full"
					>
						<Avatar className="size-7">
							<AvatarImage src={user.image ?? undefined} alt={displayName} />
							<AvatarFallback className="text-xs">{initials}</AvatarFallback>
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

			<div className="flex items-center gap-0.5">
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
							activeOptions={{ exact: true }}
							activeProps={{ className: "active" }}
						>
							<span>{item.label}</span>
						</Link>
					</Button>
				))}
			</div>

			<div className="ml-auto">
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
