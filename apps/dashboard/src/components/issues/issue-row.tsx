import { CommentIcon, IssuesIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link, useRouter } from "@tanstack/react-router";
import { memo } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { IssueSummary } from "#/lib/github.types";
import { preloadRouteOnce } from "#/lib/route-preload";

function getIssueStateProps(issue: IssueSummary) {
	if (issue.state === "closed") {
		if (issue.stateReason === "not_planned") {
			return { color: "text-muted-foreground" };
		}
		return { color: "text-purple-500" };
	}
	return { color: "text-green-500" };
}

export const IssueRow = memo(function IssueRow({
	issue,
}: {
	issue: IssueSummary;
}) {
	const { color } = getIssueStateProps(issue);
	const href = `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`;
	const router = useRouter();
	const preloadDetail = () => {
		void preloadRouteOnce(router, href).catch((error) => {
			console.error("[issue-row] failed to preload issue route", error);
		});
	};

	return (
		<Link
			to={href}
			preload={false}
			onMouseEnter={preloadDetail}
			onFocus={preloadDetail}
			onTouchStart={preloadDetail}
			className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-1"
		>
			<div className={cn("mt-[3px] shrink-0", color)}>
				<IssuesIcon size={16} strokeWidth={2} />
			</div>
			<div className="min-w-0 flex-1 flex flex-col gap-1">
				<p className="text-sm font-medium md:truncate">{issue.title}</p>
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
});
