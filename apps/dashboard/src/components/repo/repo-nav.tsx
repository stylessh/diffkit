import { ChevronDownIcon } from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { RepoOverview } from "#/lib/github.types";
import {
	type RepoNavKey,
	toggleRepoTab,
	useRepoTabs,
} from "#/lib/repo-nav-tabs";

const protectedRoute = getRouteApi("/_protected");

export type { RepoNavKey };

type RepoNavItem = {
	key: RepoNavKey;
	label: string;
	to: string;
	count?: (repo: RepoOverview) => number | null;
};

const ITEMS: RepoNavItem[] = [
	{ key: "code", label: "Code", to: "/$owner/$repo" },
	{ key: "commits", label: "Commits", to: "/$owner/$repo/commits" },
	{
		key: "branches",
		label: "Branches",
		to: "/$owner/$repo/branches",
		count: (repo) => repo.branchCount,
	},
	{
		key: "tags",
		label: "Tags",
		to: "/$owner/$repo/tags",
		count: (repo) => repo.tagCount,
	},
	{ key: "releases", label: "Releases", to: "/$owner/$repo/releases" },
	{
		key: "pulls",
		label: "Pull requests",
		to: "/$owner/$repo/pulls",
		count: (repo) => repo.openPullCount,
	},
	{
		key: "issues",
		label: "Issues",
		to: "/$owner/$repo/issues",
		count: (repo) => repo.openIssueCount,
	},
	{ key: "actions", label: "Actions", to: "/$owner/$repo/actions" },
	{ key: "settings", label: "Settings", to: "/$owner/$repo/settings" },
];

export function repoSectionLabel(key: RepoNavKey) {
	return ITEMS.find((item) => item.key === key)?.label ?? key;
}

function formatCount(n: number) {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return String(n);
}

export function RepoNav({
	owner,
	repo,
	active,
	repoData,
	className,
	actions,
	showSettings = false,
}: {
	owner: string;
	repo: string;
	active?: RepoNavKey;
	repoData?: RepoOverview | null;
	className?: string;
	actions?: ReactNode;
	showSettings?: boolean;
}) {
	const { user } = protectedRoute.useRouteContext();
	const pinned = useRepoTabs(user.id);
	const items = ITEMS.filter(
		(item) => item.key !== "settings" || showSettings || active === "settings",
	);
	const inBar = items.filter(
		(item) => pinned.includes(item.key) || item.key === active,
	);
	const tucked = items.filter((item) => !inBar.includes(item));
	const countOf = (item: RepoNavItem) =>
		repoData && item.count ? item.count(repoData) : null;

	return (
		<ViewTabs label="Repository" className={className} actions={actions}>
			{inBar.map((item) => {
				const count = countOf(item);
				return (
					<ViewTab
						key={item.key}
						asChild
						active={item.key === active}
						className="max-sm:hidden"
					>
						<Link
							to={item.to}
							params={{ owner, repo }}
							activeOptions={{ exact: true, includeSearch: false }}
						>
							{item.label}
							{count != null && count > 0 ? (
								<ViewTabCount>{formatCount(count)}</ViewTabCount>
							) : null}
						</Link>
					</ViewTab>
				);
			})}
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<ViewTab
						aria-label="More repository pages"
						className="px-2 data-[state=open]:bg-button-hover data-[state=open]:text-foreground max-sm:hidden"
					>
						<ChevronDownIcon size={14} strokeWidth={2} />
					</ViewTab>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-56">
					{tucked.map((item) => {
						const count = countOf(item);
						return (
							<DropdownMenuItem key={item.key} asChild>
								<Link to={item.to} params={{ owner, repo }}>
									<span className="flex-1">{item.label}</span>
									{count != null && count > 0 ? (
										<span className="text-xs tabular-nums text-muted-foreground">
											{formatCount(count)}
										</span>
									) : null}
								</Link>
							</DropdownMenuItem>
						);
					})}
					{tucked.length > 0 ? <DropdownMenuSeparator /> : null}
					<DropdownMenuLabel>Show in tabs</DropdownMenuLabel>
					{items
						.filter((item) => item.key !== "code")
						.map((item) => (
							<DropdownMenuCheckboxItem
								key={item.key}
								checked={pinned.includes(item.key)}
								onSelect={(event) => event.preventDefault()}
								onCheckedChange={() => toggleRepoTab(user.id, item.key)}
							>
								{item.label}
							</DropdownMenuCheckboxItem>
						))}
				</DropdownMenuContent>
			</DropdownMenu>
			<RepoSectionSwitcher
				owner={owner}
				repo={repo}
				items={items}
				current={items.find((item) => item.key === active)}
				countOf={countOf}
			/>
		</ViewTabs>
	);
}

// On phones the tab row has no room, so it collapses into one trigger naming
// the current section, with every section in its menu.
function RepoSectionSwitcher({
	owner,
	repo,
	items,
	current,
	countOf,
}: {
	owner: string;
	repo: string;
	items: RepoNavItem[];
	current?: RepoNavItem;
	countOf: (item: RepoNavItem) => number | null;
}) {
	const currentCount = current ? countOf(current) : null;
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<ViewTab
					active
					aria-label={`Repository section: ${current?.label ?? "Code"}`}
					className="sm:hidden"
				>
					{current?.label ?? "Code"}
					{currentCount != null && currentCount > 0 ? (
						<ViewTabCount>{formatCount(currentCount)}</ViewTabCount>
					) : null}
					<ChevronDownIcon size={14} strokeWidth={2} />
				</ViewTab>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				{items.map((item) => {
					const count = countOf(item);
					return (
						<DropdownMenuItem key={item.key} asChild>
							<Link
								to={item.to}
								params={{ owner, repo }}
								aria-current={item.key === current?.key ? "page" : undefined}
							>
								<span className="flex-1">{item.label}</span>
								{count != null && count > 0 ? (
									<span className="text-xs tabular-nums text-muted-foreground">
										{formatCount(count)}
									</span>
								) : null}
							</Link>
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
