import {
	ActionsIcon,
	CodeIcon,
	GitBranchIcon,
	GitCommitIcon,
	GitPullRequestIcon,
	IssuesIcon,
	PackageIcon,
} from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import type { RepoOverview } from "#/lib/github.types";

export type RepoNavKey =
	| "code"
	| "commits"
	| "branches"
	| "tags"
	| "releases"
	| "pulls"
	| "issues"
	| "actions";

type RepoNavItem = {
	key: RepoNavKey;
	label: string;
	to: string;
	icon: ComponentType<{
		size?: number;
		strokeWidth?: number;
		className?: string;
	}>;
	count?: (repo: RepoOverview) => number | null;
};

const ITEMS: RepoNavItem[] = [
	{ key: "code", label: "Code", to: "/$owner/$repo", icon: CodeIcon },
	{
		key: "commits",
		label: "Commits",
		to: "/$owner/$repo/commits",
		icon: GitCommitIcon,
	},
	{
		key: "branches",
		label: "Branches",
		to: "/$owner/$repo/branches",
		icon: GitBranchIcon,
		count: (repo) => repo.branchCount,
	},
	{
		key: "tags",
		label: "Tags",
		to: "/$owner/$repo/tags",
		icon: TagIcon,
		count: (repo) => repo.tagCount,
	},
	{
		key: "releases",
		label: "Releases",
		to: "/$owner/$repo/releases",
		icon: PackageIcon,
	},
	{
		key: "pulls",
		label: "Pull requests",
		to: "/$owner/$repo/pulls",
		icon: GitPullRequestIcon,
		count: (repo) => repo.openPullCount,
	},
	{
		key: "issues",
		label: "Issues",
		to: "/$owner/$repo/issues",
		icon: IssuesIcon,
		count: (repo) => repo.openIssueCount,
	},
	{
		key: "actions",
		label: "Actions",
		to: "/$owner/$repo/actions",
		icon: ActionsIcon,
	},
];

function formatCount(n: number) {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return String(n);
}

/** Horizontal section nav shared by repo pages (overview header + subpages). */
export function RepoNav({
	owner,
	repo,
	active,
	repoData,
	className,
}: {
	owner: string;
	repo: string;
	active?: RepoNavKey;
	repoData?: RepoOverview | null;
	className?: string;
}) {
	return (
		<nav
			aria-label="Repository"
			className={cn(
				"-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none]",
				className,
			)}
		>
			{ITEMS.map((item) => {
				const Icon = item.icon;
				const isActive = item.key === active;
				const count = repoData && item.count ? item.count(repoData) : null;
				return (
					<Link
						key={item.key}
						to={item.to}
						params={{ owner, repo }}
						aria-current={isActive ? "page" : undefined}
						className={cn(
							"flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
							isActive
								? "bg-surface-1 font-medium text-foreground"
								: "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
						)}
					>
						<Icon size={14} strokeWidth={2} className="shrink-0" />
						{item.label}
						{count != null && count > 0 ? (
							<span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-muted-foreground">
								{formatCount(count)}
							</span>
						) : null}
					</Link>
				);
			})}
		</nav>
	);
}
