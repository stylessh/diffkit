import { GitBranchIcon } from "@diffkit/icons";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "skullet/react";
import { SAMPLE_BRANCHES } from "#/components/repo/branches/branch-samples";
import { cardRowClassName, RepoCard } from "#/components/repo/repo-ui";
import { sortBranchesByRecency } from "#/lib/branch-sections";
import { formatCompareSplat } from "#/lib/compare-ref";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { CompareBranches } from "./compare-branch-bar";

const SHOWN_BRANCHES = 8;

export function CompareRecentBranches({
	owner,
	repo,
	base,
	branches,
}: {
	owner: string;
	repo: string;
	base: string;
	branches: CompareBranches;
}) {
	const recent = sortBranchesByRecency(
		branches.items.filter((branch) => branch.name !== base),
	).slice(0, SHOWN_BRANCHES);

	const isLoading = branches.loading && recent.length === 0;

	if (recent.length === 0 && !isLoading) {
		return (
			<p className="px-4 py-10 text-center text-[13px] font-[450] text-muted-foreground">
				There are no other branches to compare with {base}.
			</p>
		);
	}

	return (
		<Skeleton
			loading={isLoading}
			label="Loading branches"
			className="flex flex-col gap-2"
		>
			<h2 className="px-1 text-[13px] font-[450] text-muted-foreground">
				Choose a branch to compare with {base}
			</h2>
			<RepoCard>
				{(isLoading ? SAMPLE_BRANCHES : recent).map((branch) => (
					<Link
						key={branch.name}
						to="/$owner/$repo/compare/$"
						params={{
							owner,
							repo,
							_splat: formatCompareSplat(base, branch.name),
						}}
						className={cardRowClassName}
					>
						<GitBranchIcon
							size={14}
							strokeWidth={2}
							className="shrink-0 text-muted-foreground"
						/>
						<span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-foreground">
							{branch.name}
						</span>
						{branch.commit?.date ? (
							<span className="shrink-0 text-xs font-[450] text-muted-foreground">
								{formatRelativeTime(branch.commit.date)}
							</span>
						) : null}
					</Link>
				))}
			</RepoCard>
		</Skeleton>
	);
}
