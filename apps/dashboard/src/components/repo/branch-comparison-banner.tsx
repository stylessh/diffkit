import { GitCompareIcon, GitPullRequestIcon } from "@diffkit/icons";
import {
	Callout,
	CalloutAction,
	CalloutContent,
} from "@diffkit/ui/components/callout";
import { BranchBadge } from "@diffkit/ui/components/detail-layout";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "skullet/react";
import {
	type GitHubQueryScope,
	githubBranchComparisonQueryOptions,
} from "#/lib/github.query";
import { SAMPLE_BRANCH_COMPARISON } from "./repo-samples";
import { iconButtonClassName, pillButtonClassName } from "./repo-ui";

export function BranchComparisonBanner({
	owner,
	repo,
	scope,
	currentBranch,
	defaultBranch,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	currentBranch: string;
	defaultBranch: string;
}) {
	const isSameBranch = currentBranch === defaultBranch;
	const comparisonQuery = useQuery({
		...githubBranchComparisonQueryOptions(scope, {
			owner,
			repo,
			base: defaultBranch,
			head: currentBranch,
		}),
		enabled: !isSameBranch,
	});

	if (isSameBranch) return null;

	const comparison = comparisonQuery.data;
	const hasDifference =
		comparison != null && (comparison.aheadBy > 0 || comparison.behindBy > 0);
	if (!comparisonQuery.isPending && !hasDifference) return null;

	return (
		<Skeleton
			data={comparison}
			sample={SAMPLE_BRANCH_COMPARISON}
			label="Comparing with the default branch"
		>
			{({ aheadBy, behindBy }) => (
				<ComparisonCallout
					owner={owner}
					repo={repo}
					currentBranch={currentBranch}
					defaultBranch={defaultBranch}
					aheadBy={aheadBy}
					behindBy={behindBy}
				/>
			)}
		</Skeleton>
	);
}

function ComparisonCallout({
	owner,
	repo,
	currentBranch,
	defaultBranch,
	aheadBy,
	behindBy,
}: {
	owner: string;
	repo: string;
	currentBranch: string;
	defaultBranch: string;
	aheadBy: number;
	behindBy: number;
}) {
	const compareUrl = `/${owner}/${repo}/compare/${defaultBranch}...${currentBranch}`;
	const createPrUrl = `${compareUrl}?expand=1`;

	return (
		<Callout variant="default">
			<CalloutContent className="flex-wrap text-muted-foreground">
				<span>This branch is</span>
				{aheadBy > 0 && (
					<a
						href={compareUrl}
						className="font-medium text-foreground tabular-nums hover:underline"
					>
						{aheadBy} {aheadBy === 1 ? "commit" : "commits"} ahead
					</a>
				)}
				{aheadBy > 0 && behindBy > 0 && <span>of and</span>}
				{aheadBy === 0 && behindBy > 0 && <span>of</span>}
				{behindBy > 0 && (
					<a
						href={compareUrl}
						className="font-medium text-foreground tabular-nums hover:underline"
					>
						{behindBy} {behindBy === 1 ? "commit" : "commits"} behind
					</a>
				)}
				<BranchBadge>{defaultBranch}</BranchBadge>
				<span>.</span>
			</CalloutContent>
			<CalloutAction className="flex items-center gap-1.5">
				<a
					href={compareUrl}
					aria-label="Open compare view"
					className={iconButtonClassName}
				>
					<GitCompareIcon size={14} />
				</a>
				{aheadBy > 0 && (
					<a href={createPrUrl} className={pillButtonClassName}>
						<GitPullRequestIcon size={14} strokeWidth={2} />
						Create pull request
					</a>
				)}
			</CalloutAction>
		</Callout>
	);
}
