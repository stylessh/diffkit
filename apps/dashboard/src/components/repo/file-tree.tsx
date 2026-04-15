import { FileIcon, FolderIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { RepoTreeEntry } from "#/lib/github.types";

export function FileTree({
	entries,
	owner,
	repo,
	currentRef,
}: {
	entries: RepoTreeEntry[];
	owner: string;
	repo: string;
	currentRef: string;
}) {
	return (
		<div className="overflow-hidden rounded-b-lg border">
			{entries.map((entry, index) => (
				<FileTreeRow
					key={entry.sha}
					entry={entry}
					owner={owner}
					repo={repo}
					currentRef={currentRef}
					isLast={index === entries.length - 1}
				/>
			))}
		</div>
	);
}

function FileTreeRow({
	entry,
	owner,
	repo,
	currentRef,
	isLast,
}: {
	entry: RepoTreeEntry;
	owner: string;
	repo: string;
	currentRef: string;
	isLast: boolean;
}) {
	const Icon = entry.type === "dir" ? FolderIcon : FileIcon;
	const isDir = entry.type === "dir";

	return (
		<Link
			to={isDir ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$"}
			params={{
				owner,
				repo,
				_splat: `${currentRef}/${entry.name}`,
			}}
			className={cn(
				"grid grid-cols-[200px_minmax(0,1fr)_80px] items-center gap-4 px-4 py-2 text-sm hover:bg-surface-1",
				!isLast && "border-b",
			)}
		>
			<div className="flex min-w-0 items-center gap-2.5">
				<Icon
					size={15}
					strokeWidth={1.8}
					className={cn(
						"shrink-0",
						isDir ? "text-accent-foreground" : "text-muted-foreground",
					)}
				/>
				<span
					className={cn(
						"truncate",
						isDir ? "font-medium text-accent-foreground" : "text-foreground",
					)}
				>
					{entry.name}
				</span>
			</div>
			<span className="truncate text-muted-foreground">
				{entry.lastCommit?.message ?? ""}
			</span>
			<span className="text-right text-xs text-muted-foreground">
				{entry.lastCommit?.date
					? formatRelativeTime(entry.lastCommit.date)
					: ""}
			</span>
		</Link>
	);
}
