import { GitPullRequestIcon } from "@diffkit/icons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatCompareSplat } from "#/lib/compare-ref";
import {
	type GitHubQueryScope,
	githubRepoRefComparisonQueryOptions,
} from "#/lib/github.query";
import { pillButtonClassName } from "../repo-ui";

export function BranchCreatePullRequest({
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
	const comparison = useQuery(
		githubRepoRefComparisonQueryOptions(scope, { owner, repo, base, head }),
	).data;
	if (!comparison || comparison.aheadBy === 0) return null;

	return (
		<Link
			to="/$owner/$repo/compare/$"
			params={{ owner, repo, _splat: formatCompareSplat(base, head) }}
			search={{ expand: 1 }}
			data-action
			aria-label={`Create pull request from ${head}`}
			className={pillButtonClassName}
		>
			<GitPullRequestIcon size={14} strokeWidth={2} />
			Create PR
		</Link>
	);
}
