import { FileIcon, FolderIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { RepoTreeEntry } from "#/lib/github.types";

export function FileTree({ entries }: { entries: RepoTreeEntry[] }) {
	return (
		<div className="overflow-hidden rounded-b-lg border">
			{entries.map((entry, index) => (
				<FileTreeRow
					key={entry.sha}
					entry={entry}
					isLast={index === entries.length - 1}
				/>
			))}
		</div>
	);
}

function FileTreeRow({
	entry,
	isLast,
}: {
	entry: RepoTreeEntry;
	isLast: boolean;
}) {
	const Icon = entry.type === "dir" ? FolderIcon : FileIcon;

	return (
		<div
			className={cn(
				"grid grid-cols-[200px_minmax(0,1fr)_80px] items-center gap-4 px-4 py-2 text-sm hover:bg-surface-0",
				!isLast && "border-b",
			)}
		>
			<div className="flex min-w-0 items-center gap-2.5">
				<Icon
					size={15}
					strokeWidth={1.8}
					className={cn(
						"shrink-0",
						entry.type === "dir"
							? "text-accent-foreground"
							: "text-muted-foreground",
					)}
				/>
				<span
					className={cn(
						"truncate",
						entry.type === "dir"
							? "font-medium text-accent-foreground"
							: "text-foreground",
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
		</div>
	);
}
