import { Chip } from "@diffkit/ui/components/chip";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { SkeletonBox } from "skullet/react";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
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
 * GitHub-style diverging ahead/behind meter in a pill: behind on the left,
 * ahead on the right. Owns one compare request, so mount it only for rows
 * that are actually rendered.
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
	const isSample = useIsSkeletonSample();
	const comparisonQuery = useQuery({
		...githubRepoRefComparisonQueryOptions(scope, { owner, repo, base, head }),
		enabled: !isSample,
	});
	const comparison = comparisonQuery.data;

	if (comparisonQuery.isPending) {
		return <SkeletonBox width={96} height={24} radius={12} />;
	}
	if (!comparison) return null;

	const { aheadBy, behindBy } = comparison;
	const summary = `${behindBy} ${behindBy === 1 ? "commit" : "commits"} behind, ${aheadBy} ahead of ${base}`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Chip
					role="img"
					aria-label={summary}
					className="shrink-0 gap-1.5 tabular-nums"
				>
					<span>{behindBy}</span>
					<span aria-hidden className="flex h-1 w-12 items-stretch gap-px">
						<span className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-pill-neutral">
							<span
								className="rounded-l-full bg-icon-faint"
								style={{ width: `${barPercent(behindBy)}%` }}
							/>
						</span>
						<span className="flex flex-1 overflow-hidden rounded-r-full bg-pill-neutral">
							<span
								className="rounded-r-full bg-indigo"
								style={{ width: `${barPercent(aheadBy)}%` }}
							/>
						</span>
					</span>
					<span>{aheadBy}</span>
				</Chip>
			</TooltipTrigger>
			<TooltipContent>{summary}</TooltipContent>
		</Tooltip>
	);
}
