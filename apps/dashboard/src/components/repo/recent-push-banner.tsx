import { GitBranchIcon, GitPullRequestIcon } from "@diffkit/icons";
import {
	Callout,
	CalloutAction,
	CalloutContent,
} from "@diffkit/ui/components/callout";
import { useQuery } from "@tanstack/react-query";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	type GitHubQueryScope,
	githubRecentPushableBranchQueryOptions,
} from "#/lib/github.query";

export function RecentPushBanner({
	owner,
	repo,
	scope,
	defaultBranch,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	defaultBranch: string;
}) {
	const recentQuery = useQuery(
		githubRecentPushableBranchQueryOptions(scope, { owner, repo }),
	);

	const recent = recentQuery.data;
	if (!recent) return null;

	const createPrUrl = `/${owner}/${repo}/compare/${defaultBranch}...${recent.branch}?expand=1`;

	return (
		<Callout variant="warning">
			<CalloutContent>
				<GitBranchIcon size={15} strokeWidth={2} />
				<span className="font-medium">{recent.branch}</span>
				<span className="text-pill-warning-text">
					had recent pushes {formatRelativeTime(recent.pushedAt)}
				</span>
			</CalloutContent>
			<CalloutAction>
				<a
					href={createPrUrl}
					className="inline-flex h-7 items-center gap-1.5 rounded-md bg-button px-2.5 text-xs font-medium text-foreground shadow-button transition-colors hover:bg-button-hover"
				>
					<GitPullRequestIcon size={13} strokeWidth={2} />
					Compare & pull request
				</a>
			</CalloutAction>
		</Callout>
	);
}
