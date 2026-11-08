import { GitPullRequestDraftIcon, GitPullRequestIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { PullSummary } from "#/lib/github.types";
import type { PullStackEntry } from "#/lib/pull-stack";

/**
 * Compact chain of PRs in a stack. The current PR is highlighted; every other
 * entry links to its PR page.
 */
export function PullStackList({
	entries,
	currentNumber,
	owner,
	repo,
	className,
}: {
	entries: PullStackEntry<PullSummary>[];
	currentNumber: number;
	owner: string;
	repo: string;
	className?: string;
}) {
	return (
		<ol className={cn("flex flex-col gap-0.5 text-xs", className)}>
			{entries.map(({ pull, depth }) => {
				const isCurrent = pull.number === currentNumber;
				const Icon = pull.isDraft
					? GitPullRequestDraftIcon
					: GitPullRequestIcon;
				return (
					<li key={pull.number} style={{ paddingLeft: depth * 12 }}>
						<Link
							to="/$owner/$repo/pull/$pullId"
							params={{ owner, repo, pullId: String(pull.number) }}
							preload={false}
							aria-current={isCurrent ? "page" : undefined}
							className={cn(
								"flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
								isCurrent
									? "bg-surface-2 font-medium text-foreground"
									: "text-muted-foreground hover:bg-ghost-hover hover:text-foreground",
							)}
						>
							<Icon
								size={13}
								strokeWidth={2}
								className={cn(
									"shrink-0",
									pull.isDraft ? "text-muted-foreground" : "text-success",
								)}
							/>
							<span className="shrink-0 tabular-nums">#{pull.number}</span>
							<span className="min-w-0 truncate">{pull.title}</span>
						</Link>
					</li>
				);
			})}
		</ol>
	);
}
