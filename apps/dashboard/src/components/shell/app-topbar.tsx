import { SearchIcon } from "@diffkit/icons";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { modKeyLabel } from "#/lib/shell/mod-key";
import { openCommandPalette } from "#/lib/shell/shell-overlay";
import { AccountMenu, type ShellUser } from "./account-menu";
import { CreateMenu } from "./create-menu";
import { type NavItem, TopbarNav } from "./workspace-nav";

function SearchTrigger() {
	const keys = [modKeyLabel(), "K"];
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label="Search"
					onClick={openCommandPalette}
					className="flex h-7 w-44 shrink-0 items-center gap-2 rounded-md pr-1.5 pl-2 text-[13px] text-muted-foreground shadow-chip transition-colors hover:bg-nav-hover hover:text-foreground max-xl:w-auto max-xl:shadow-none"
				>
					<SearchIcon size={14} strokeWidth={2} className="shrink-0" />
					<span className="flex-1 text-left max-xl:hidden">Search…</span>
					<kbd className="font-sans text-[11px] tracking-wide text-muted-foreground max-xl:hidden">
						{keys.join("")}
					</kbd>
				</button>
			</TooltipTrigger>
			<TooltipContent keys={keys}>Search</TooltipContent>
		</Tooltip>
	);
}

export function AppTopbar({
	user,
	viewerLogin,
	navItems,
}: {
	user: ShellUser;
	viewerLogin?: string;
	navItems: NavItem[];
}) {
	return (
		<header className="flex h-11 shrink-0 items-center gap-2 px-3 max-md:hidden">
			<AccountMenu user={user} viewerLogin={viewerLogin} />
			<span aria-hidden className="h-4 w-px shrink-0 bg-header-rule" />
			<nav aria-label="Workspace" className="min-w-0 flex-1">
				<TopbarNav items={navItems} />
			</nav>
			<div className="flex shrink-0 items-center gap-1.5">
				<SearchTrigger />
				<CreateMenu />
			</div>
		</header>
	);
}

export function MobileTopbar({
	user,
	viewerLogin,
}: {
	user: ShellUser;
	viewerLogin?: string;
}) {
	return (
		<header className="flex h-11 shrink-0 items-center gap-1 border-b-[0.5px] border-header-rule bg-main px-2 md:hidden">
			<AccountMenu user={user} viewerLogin={viewerLogin} />
			<PageIconButton
				aria-label="Search"
				onClick={openCommandPalette}
				className="ml-auto"
			>
				<SearchIcon size={16} strokeWidth={2} />
			</PageIconButton>
			<CreateMenu />
		</header>
	);
}
