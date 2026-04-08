import { CommentIcon, IssuesIcon } from "@quickhub/icons";
import { cn } from "@quickhub/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { formatRelativeTime } from "#/components/pulls/pull-request-row";
import type { IssueSummary } from "#/lib/github.types";

function getIssueStateProps(issue: IssueSummary) {
	if (issue.state === "closed") {
		if (issue.stateReason === "not_planned") {
			return { color: "text-muted-foreground" };
		}
		return { color: "text-purple-500" };
	}
	return { color: "text-green-500" };
}

export function IssueRow({ issue }: { issue: IssueSummary }) {
	const { color } = getIssueStateProps(issue);
	const href = `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`;

	return (
		<Link
			to={href}
			className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-1"
		>
			<div className={cn("mt-[3px] shrink-0", color)}>
				<IssuesIcon size={16} strokeWidth={2} />
			</div>
			<div className="min-w-0 flex-1 flex flex-col gap-1">
				<p className="truncate text-sm font-medium">{issue.title}</p>
				<p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
					{issue.repository.fullName} #{issue.number}
					{issue.author && (
						<>
							<span>·</span>
							<img
								src={issue.author.avatarUrl}
								alt={issue.author.login}
								className="size-3.5 rounded-full border border-border"
							/>
							<span>{issue.author.login}</span>
						</>
					)}
					<span>·</span>
					<span>{formatRelativeTime(issue.updatedAt)}</span>
				</p>
			</div>
			{issue.comments > 0 && (
				<div className="mt-[3px] flex shrink-0 items-center gap-4">
					<span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
						<CommentIcon size={13} strokeWidth={2} />
						{issue.comments}
					</span>
				</div>
			)}
		</Link>
	);
}
