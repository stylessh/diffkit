import { Skeleton } from "@diffkit/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import {
	type GitHubQueryScope,
	githubRepoRefComparisonQueryOptions,
} from "#/lib/github.query";

/** Log scale so a 3-commit branch is visible next to a 3,000-commit one. */
function barPercent(count: number) {
	if (count <= 0) return 0;
	return Math.max(8, Math.min(100, (Math.log10(count + 1) / 3) * 100));
}

/**
 * GitHub-style diverging ahead/behind meter. Owns one compare request, so it
 * should only be mounted for rows that are actually rendered.
 */
export function BranchAheadBehind({
	owner,
	repo,
	scope,
	base,
	head,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	base: string;
	head: string;
}) {
	const comparisonQuery = useQuery(
		githubRepoRefComparisonQueryOptions(scope, { owner, repo, base, head }),
	);
	const comparison = comparisonQuery.data;

	if (comparisonQuery.isPending) {
		return <Skeleton className="h-4 w-24 rounded" />;
	}
	if (!comparison) {
		return (
			<span className="w-24 text-center text-xs text-muted-foreground">—</span>
		);
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					className="flex w-24 flex-col gap-1"
					role="img"
					aria-label={`${comparison.behindBy} behind, ${comparison.aheadBy} ahead of ${base}`}
				>
					<div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
						<span>{comparison.behindBy}</span>
						<span>{comparison.aheadBy}</span>
					</div>
					<div className="flex h-1 items-stretch gap-px">
						<div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-surface-1">
							<div
								className="rounded-l-full bg-muted-foreground/50"
								style={{ width: `${barPercent(comparison.behindBy)}%` }}
							/>
						</div>
						<div className="flex flex-1 overflow-hidden rounded-r-full bg-surface-1">
							<div
								className="rounded-r-full bg-indigo/70"
								style={{ width: `${barPercent(comparison.aheadBy)}%` }}
							/>
						</div>
					</div>
				</div>
			</TooltipTrigger>
			<TooltipContent>
				{comparison.behindBy} commit{comparison.behindBy === 1 ? "" : "s"}{" "}
				behind, {comparison.aheadBy} ahead of {base}
			</TooltipContent>
		</Tooltip>
	);
}
