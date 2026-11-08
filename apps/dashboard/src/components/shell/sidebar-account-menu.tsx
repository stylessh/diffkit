import {
	ArchiveIcon,
	ChevronDownIcon,
	LogOutIcon,
	MoonIcon,
	SettingsIcon,
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
import { Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { signOutToLogin } from "#/lib/auth-actions";
import type { SidebarDensity } from "./sidebar-nav";

export type ShellUser = {
	id: string;
	name?: string | null;
	email: string;
	image?: string | null;
};

const themeOptions = [
	{ value: "light", icon: SunIcon, label: "Light" },
	{ value: "dark", icon: MoonIcon, label: "Dark" },
	{ value: "system", icon: SystemIcon, label: "System" },
] as const;

function initialsOf(name: string) {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function UserAvatar({
	user,
	className,
}: {
	user: ShellUser;
	className: string;
}) {
	const displayName = user.name ?? user.email;
	return (
		<Avatar className={className}>
			<AvatarImage src={user.image ?? undefined} alt="" />
			<AvatarFallback delayMs={user.image ? 400 : 0} className="text-[9px]">
				{initialsOf(displayName)}
			</AvatarFallback>
		</Avatar>
	);
}

function ThemeSwitch() {
	const { theme, setTheme } = useTheme();
	return (
		<div className="flex items-center gap-0.5 rounded-md bg-group p-0.5">
			{themeOptions.map((option) => (
				<button
					key={option.value}
					type="button"
					onClick={() => setTheme(option.value)}
					className={cn(
						"flex size-6 items-center justify-center rounded-sm transition-colors",
						theme === option.value
							? "bg-tab-selected text-foreground shadow-tab-selected"
							: "text-muted-foreground hover:text-foreground",
					)}
					aria-label={`${option.label} theme`}
					aria-pressed={theme === option.value}
				>
					<option.icon size={13} strokeWidth={2} />
				</button>
			))}
		</div>
	);
}

export function SidebarAccountMenu({
	user,
	viewerLogin,
	density,
}: {
	user: ShellUser;
	viewerLogin?: string;
	density: SidebarDensity;
}) {
	const displayName = user.name ?? user.email;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={displayName}
					className={cn(
						"flex h-7 min-w-0 items-center gap-[7px] rounded-lg text-text-strong transition-colors hover:bg-nav-hover",
						density === "rail" ? "w-7 justify-center" : "pr-1.5 pl-1",
					)}
				>
					<UserAvatar user={user} className="size-5 shrink-0" />
					{density === "full" ? (
						<>
							<span className="truncate text-[13px] font-[550] tracking-[-0.1px]">
								{viewerLogin ?? displayName}
							</span>
							<ChevronDownIcon
								size={12}
								strokeWidth={2}
								className="shrink-0 text-muted-foreground"
							/>
						</>
					) : null}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-60">
				<DropdownMenuLabel className="flex items-center gap-3 py-2">
					<UserAvatar user={user} className="size-8" />
					<div className="flex min-w-0 flex-1 flex-col">
						<span className="truncate text-sm font-medium text-foreground">
							{displayName}
						</span>
						{viewerLogin ? (
							<span className="truncate text-xs font-normal text-muted-foreground">
								@{viewerLogin}
							</span>
						) : null}
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
				<div className="flex h-8 items-center justify-between pr-1 pl-2 text-[13px] font-[450] text-text-header">
					Theme
					<ThemeSwitch />
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => void signOutToLogin()}>
					<LogOutIcon size={16} strokeWidth={2} />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
