import {
	GitPullRequestIcon,
	HomeIcon,
	InboxIcon,
	IssuesIcon,
	ReviewsIcon,
} from "@diffkit/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { Link } from "@tanstack/react-router";
import { type ComponentType, memo } from "react";

export type ShellCounts = {
	pulls?: number;
	issues?: number;
	reviews?: number;
};

type NavIcon = ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

export type NavItem = {
	to: string;
	label: string;
	icon: NavIcon;
	keys?: readonly string[];
	badge: NavBadge;
};

type NavBadge =
	| { kind: "none" }
	| { kind: "unread" }
	| { kind: "count"; value: number };

function countBadge(value: number | undefined): NavBadge {
	return typeof value === "number" && value > 0
		? { kind: "count", value }
		: { kind: "none" };
}

export function workspaceNavItems(
	counts: ShellCounts,
	hasUnread: boolean,
): NavItem[] {
	return [
		{
			to: "/",
			label: "Overview",
			icon: HomeIcon,
			keys: ["G", "H"],
			badge: { kind: "none" },
		},
		{
			to: "/inbox",
			label: "Inbox",
			icon: InboxIcon,
			badge: hasUnread ? { kind: "unread" } : { kind: "none" },
		},
		{
			to: "/pulls",
			label: "Pull requests",
			icon: GitPullRequestIcon,
			keys: ["G", "P"],
			badge: countBadge(counts.pulls),
		},
		{
			to: "/reviews",
			label: "Reviews",
			icon: ReviewsIcon,
			keys: ["G", "R"],
			badge: countBadge(counts.reviews),
		},
		{
			to: "/issues",
			label: "Issues",
			icon: IssuesIcon,
			keys: ["G", "I"],
			badge: countBadge(counts.issues),
		},
	];
}

function sameBadge(a: NavBadge, b: NavBadge) {
	if (a.kind === "count" && b.kind === "count") return a.value === b.value;
	return a.kind === b.kind;
}

/** The layout rebuilds the items on every render, so they are compared by what the nav shows. */
function sameNav(a: { items: NavItem[] }, b: { items: NavItem[] }) {
	return (
		a.items.length === b.items.length &&
		a.items.every((item, index) => {
			const other = b.items[index];
			return item.to === other.to && sameBadge(item.badge, other.badge);
		})
	);
}

function accessibleName(item: NavItem) {
	switch (item.badge.kind) {
		case "count":
			return `${item.label} ${item.badge.value}`;
		case "unread":
			return `${item.label}, unread`;
		case "none":
			return item.label;
	}
}

function TopbarBadge({ badge }: { badge: NavBadge }) {
	switch (badge.kind) {
		case "count":
			return (
				<span className="text-[11px] font-[450] tabular-nums text-muted-foreground max-lg:hidden">
					{badge.value}
				</span>
			);
		case "unread":
			return (
				<span
					aria-hidden
					className="size-1.5 rounded-full bg-indigo max-lg:absolute max-lg:top-1 max-lg:right-1"
				/>
			);
		case "none":
			return null;
	}
}

export const TopbarNav = memo(function TopbarNav({
	items,
}: {
	items: NavItem[];
}) {
	return (
		<div className="flex min-w-0 items-center gap-0.5">
			{items.map((item) => (
				<Tooltip key={item.to}>
					<TooltipTrigger asChild>
						<Link
							to={item.to}
							preload={false}
							activeOptions={{ exact: true, includeSearch: false }}
							activeProps={{ className: "active", "aria-current": "page" }}
							aria-label={accessibleName(item)}
							className="relative flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-text-nav transition-colors hover:bg-nav-hover hover:text-foreground lg:px-2.5 [&.active]:bg-nav-selected [&.active]:text-foreground"
						>
							<item.icon size={14} strokeWidth={2} className="shrink-0" />
							<span className="max-lg:hidden">{item.label}</span>
							<TopbarBadge badge={item.badge} />
						</Link>
					</TooltipTrigger>
					<TooltipContent keys={item.keys}>{item.label}</TooltipContent>
				</Tooltip>
			))}
		</div>
	);
}, sameNav);

export const MobileNavBar = memo(function MobileNavBar({
	items,
}: {
	items: NavItem[];
}) {
	return (
		<nav
			aria-label="Workspace"
			className="flex shrink-0 items-stretch border-t-[0.5px] border-header-rule bg-main pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			{items.map((item) => (
				<Link
					key={item.to}
					to={item.to}
					preload={false}
					activeOptions={{ exact: true, includeSearch: false }}
					activeProps={{ className: "active", "aria-current": "page" }}
					aria-label={accessibleName(item)}
					className="flex h-12 flex-1 items-center justify-center text-icon-faint transition-colors [&.active]:text-foreground"
				>
					<span className="relative">
						<item.icon size={20} strokeWidth={1.8} />
						{item.badge.kind === "count" ? (
							<span className="absolute -top-1.5 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-nav-selected px-1 text-[10px] leading-none font-medium tabular-nums text-text-strong">
								{item.badge.value > 99 ? "99+" : item.badge.value}
							</span>
						) : null}
						{item.badge.kind === "unread" ? (
							<span
								aria-hidden
								className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-indigo"
							/>
						) : null}
					</span>
				</Link>
			))}
		</nav>
	);
}, sameNav);
