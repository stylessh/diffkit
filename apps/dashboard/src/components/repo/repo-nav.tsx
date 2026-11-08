import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { RepoOverview } from "#/lib/github.types";

export type RepoNavKey =
	| "code"
	| "commits"
	| "branches"
	| "tags"
	| "releases"
	| "pulls"
	| "issues"
	| "actions"
	| "settings";

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
	const items = ITEMS.filter(
		(item) => item.key !== "settings" || showSettings || active === "settings",
	);
	return (
		<ViewTabs label="Repository" className={className} actions={actions}>
			{items.map((item) => {
				const count = repoData && item.count ? item.count(repoData) : null;
				return (
					<ViewTab key={item.key} asChild active={item.key === active}>
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
		</ViewTabs>
	);
}
