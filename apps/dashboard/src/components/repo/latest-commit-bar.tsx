import { GitCommitIcon } from "@diffkit/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { RepoOverview } from "#/lib/github.types";

export function LatestCommitBar({ repo }: { repo: RepoOverview }) {
	const commit = repo.latestCommit;
	if (!commit) return null;

	const shortSha = commit.sha.slice(0, 7);
	const firstLine = commit.message.split("\n")[0];

	return (
		<div className="flex items-center gap-3 rounded-t-lg border border-b-0 bg-surface-0 px-4 py-2.5 text-sm">
			{commit.author && (
				<img
					src={commit.author.avatarUrl}
					alt={commit.author.login}
					className="size-5 shrink-0 rounded-full"
				/>
			)}
			<span className="font-medium">{commit.author?.login ?? "Unknown"}</span>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="min-w-0 flex-1 truncate text-muted-foreground">
						{firstLine}
					</span>
				</TooltipTrigger>
				{firstLine.length > 60 && (
					<TooltipContent side="bottom" className="max-w-sm">
						{firstLine}
					</TooltipContent>
				)}
			</Tooltip>
			<div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="flex items-center gap-1">
							<GitCommitIcon size={14} />
							<code>{shortSha}</code>
						</span>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						<code>{commit.sha}</code>
					</TooltipContent>
				</Tooltip>
				<span>{formatRelativeTime(commit.date)}</span>
			</div>
		</div>
	);
}
