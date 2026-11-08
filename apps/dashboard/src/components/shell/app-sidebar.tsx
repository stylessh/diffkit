import {
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	HomeIcon,
	InboxIcon,
	IssuesIcon,
	ReviewsIcon,
	SearchIcon,
} from "@diffkit/icons";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
	githubNotificationsQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import { modKeyLabel } from "#/lib/shell/mod-key";
import { openCommandPalette } from "#/lib/shell/shell-overlay";
import { useHasMounted } from "#/lib/use-has-mounted";
import { CreateMenu } from "./create-menu";
import { RepoSwitcherButton } from "./repo-switcher";
import { type ShellUser, SidebarAccountMenu } from "./sidebar-account-menu";
import { SidebarHelpMenu } from "./sidebar-help-menu";
import {
	type SidebarDensity,
	type SidebarIcon,
	SidebarNavRow,
} from "./sidebar-nav";
import { SidebarPinnedRepos } from "./sidebar-pinned-repos";

export type ShellCounts = {
	pulls?: number;
	issues?: number;
	reviews?: number;
	drafts?: number;
};

type NavItem = {
	to: string;
	label: string;
	icon: SidebarIcon;
	keys?: readonly string[];
	count?: number;
	dot?: boolean;
};

function navItems(counts: ShellCounts, hasUnread: boolean): NavItem[] {
	return [
		{ to: "/", label: "Overview", icon: HomeIcon, keys: ["G", "H"] },
		{ to: "/inbox", label: "Inbox", icon: InboxIcon, dot: hasUnread },
		{
			to: "/pulls",
			label: "Pull requests",
			icon: GitPullRequestIcon,
			keys: ["G", "P"],
			count: counts.pulls,
		},
		{
			to: "/reviews",
			label: "Reviews",
			icon: ReviewsIcon,
			keys: ["G", "R"],
			count: counts.reviews,
		},
		{
			to: "/issues",
			label: "Issues",
			icon: IssuesIcon,
			keys: ["G", "I"],
			count: counts.issues,
		},
		{
			to: "/drafts",
			label: "Drafts",
			icon: GitPullRequestDraftIcon,
			keys: ["G", "D"],
			count: counts.drafts,
		},
	];
}

function SearchButton() {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<PageIconButton aria-label="Search" onClick={openCommandPalette}>
					<SearchIcon size={14} strokeWidth={2} />
				</PageIconButton>
			</TooltipTrigger>
			<TooltipContent keys={[modKeyLabel(), "K"]}>Search</TooltipContent>
		</Tooltip>
	);
}

export function AppSidebar({
	user,
	counts,
	density,
	footerAction,
}: {
	user: ShellUser;
	counts: ShellCounts;
	density: SidebarDensity;
	footerAction?: ReactNode;
}) {
	const hasMounted = useHasMounted();
	const scope = { userId: user.id };
	const viewerQuery = useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});
	const notificationsQuery = useQuery({
		...githubNotificationsQueryOptions(scope, { all: false }),
		enabled: hasMounted,
	});
	const hasUnread = (notificationsQuery.data?.notifications?.length ?? 0) > 0;
	const rail = density === "rail";

	return (
		<nav aria-label="Workspace" className="flex h-full min-h-0 flex-col">
			<div
				className={cn(
					"flex shrink-0 gap-1 pt-3",
					rail ? "flex-col items-center" : "h-10 items-center pr-3 pl-[15px]",
				)}
			>
				<SidebarAccountMenu
					user={user}
					viewerLogin={viewerQuery.data?.login}
					density={density}
				/>
				<div
					className={cn(
						!rail && "ml-auto",
						"flex items-center gap-1",
						rail && "flex-col",
					)}
				>
					<SearchButton />
					<CreateMenu align={rail ? "start" : "end"} />
				</div>
			</div>

			<div className={cn("flex shrink-0 pt-2 pb-3", rail ? "px-0" : "px-3")}>
				<RepoSwitcherButton
					density={density}
					className={cn(!rail && "w-full")}
				/>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto pb-4 [scrollbar-width:none]">
				<div className="flex flex-col gap-px">
					{navItems(counts, hasUnread).map((item) => (
						<SidebarNavRow key={item.to} {...item} density={density} />
					))}
				</div>
				<SidebarPinnedRepos userId={user.id} density={density} />
			</div>

			<div
				className={cn(
					"flex shrink-0 gap-1.5 pb-2",
					rail ? "flex-col items-center pt-2" : "h-11 items-center px-3",
				)}
			>
				<SidebarHelpMenu />
				{footerAction ? (
					<div className={cn(!rail && "ml-auto")}>{footerAction}</div>
				) : null}
			</div>
		</nav>
	);
}
