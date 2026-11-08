import { GitBranchIcon, GitPullRequestIcon } from "@diffkit/icons";
import {
	Callout,
	CalloutAction,
	CalloutContent,
} from "@diffkit/ui/components/callout";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatCompareSplat } from "#/lib/compare-ref";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubRecentPushableBranchQueryOptions,
} from "#/lib/github.query";
import { isRecentPush } from "#/lib/recent-push";
import { pillButtonClassName } from "./repo-ui";

export function RecentPushBanner({
	owner,
	repo,
	scope,
	defaultBranch,
	className,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	defaultBranch: string;
	className?: string;
}) {
	const recentQuery = useQuery(
		githubRecentPushableBranchQueryOptions(scope, { owner, repo }),
	);

	const recent = recentQuery.data;
	if (!recent || !isRecentPush(recent.pushedAt)) return null;

	return (
		<Callout variant="warning" className={className}>
			<CalloutContent>
				<GitBranchIcon size={14} strokeWidth={2} />
				<span className="min-w-0 truncate font-mono text-xs font-medium">
					{recent.branch}
				</span>
				<span className="shrink-0 text-pill-warning-text max-sm:hidden">
					had recent pushes {formatRelativeTime(recent.pushedAt)}
				</span>
			</CalloutContent>
			<CalloutAction>
				<Link
					to="/$owner/$repo/compare/$"
					params={{
						owner,
						repo,
						_splat: formatCompareSplat(defaultBranch, recent.branch),
					}}
					search={{ expand: 1 }}
					className={pillButtonClassName}
				>
					<GitPullRequestIcon size={14} strokeWidth={2} />
					Compare &amp; pull request
				</Link>
			</CalloutAction>
		</Callout>
	);
}
