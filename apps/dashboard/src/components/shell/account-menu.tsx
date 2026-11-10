import {
	ArchiveIcon,
	BugIcon,
	ChevronDownIcon,
	CommandIcon,
	ExternalLinkIcon,
	LogOutIcon,
	MoonIcon,
	SettingsIcon,
	SunIcon,
	SystemIcon,
	UserCircleIcon,
	XLogo,
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
import { memo } from "react";
import { signOutToLogin } from "#/lib/auth-actions";

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

export const AccountMenu = memo(function AccountMenu({
	user,
	viewerLogin,
}: {
	user: ShellUser;
	viewerLogin?: string;
}) {
	const displayName = user.name ?? user.email;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={`Account, ${viewerLogin ?? displayName}`}
					className="flex h-7 shrink-0 items-center gap-1 rounded-md pr-1.5 pl-1 text-text-strong transition-colors hover:bg-nav-hover data-[state=open]:bg-nav-hover"
				>
					<UserAvatar user={user} className="size-5 shrink-0" />
					<ChevronDownIcon
						size={12}
						strokeWidth={2}
						className="shrink-0 text-muted-foreground"
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-60">
				<DropdownMenuLabel className="h-auto gap-3 py-2">
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
				<DropdownMenuGroup aria-label="Help">
					<DropdownMenuItem asChild>
						<Link to="/settings/shortcuts">
							<CommandIcon size={16} strokeWidth={2} />
							Keyboard shortcuts
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
					<DropdownMenuItem asChild>
						<Link
							to="/$owner/$repo"
							params={{ owner: "stylessh", repo: "diffkit" }}
						>
							<ExternalLinkIcon size={16} strokeWidth={2} />
							DiffKit on GitHub
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<a
							href="https://x.com/stylesshDev"
							target="_blank"
							rel="noopener noreferrer"
						>
							<span className="flex size-4 items-center justify-center">
								<XLogo className="size-3.5" />
							</span>
							Check for updates
						</a>
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
});
