import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	CopyIcon,
	MoreHorizontalIcon,
} from "@diffkit/icons";
import { LineCounts } from "@diffkit/ui/components/detail-layout";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import { cn } from "@diffkit/ui/lib/utils";
import { memo, useCallback, useState } from "react";
import { FileTypeIcon } from "#/components/pulls/review/review-icons";
import type { DiffFile, DiffFileStatus } from "#/lib/diffs/diff-files";

const CHANGE_LABEL: Partial<
	Record<DiffFileStatus, { label: string; tone: string }>
> = {
	added: { label: "New", tone: "text-added" },
	removed: { label: "Deleted", tone: "text-removed" },
	renamed: { label: "Renamed", tone: "text-muted-foreground" },
};

function splitPath(path: string) {
	const at = path.lastIndexOf("/");
	return { name: path.slice(at + 1), dir: path.slice(0, at + 1) };
}

export const DiffFileHeader = memo(function DiffFileHeader({
	file,
	isCollapsed,
	onToggleCollapse,
	isViewed,
	onViewedChange,
}: {
	file: DiffFile;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	isViewed?: boolean;
	onViewedChange: (viewed: boolean) => void;
}) {
	const [copied, setCopied] = useState(false);
	const { name, dir } = splitPath(file.path);
	const moved = file.previousPath ? splitPath(file.previousPath) : null;
	const change = CHANGE_LABEL[file.status];
	const emptyLabel =
		file.fileDiff.hunks.length > 0
			? null
			: file.fileDiff.type === "rename-pure"
				? "No content changes"
				: "Binary or too large to display";

	const copyPath = useCallback(() => {
		void navigator.clipboard.writeText(file.path).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}, [file.path]);

	return (
		<div
			className={cn(
				"flex h-9 items-center gap-2 bg-surface-0 pr-2 pl-4 text-xs leading-4 font-[450] select-none",
				!isCollapsed && "border-b-[0.5px] border-card-border",
			)}
		>
			<button
				type="button"
				onClick={onToggleCollapse}
				aria-expanded={!isCollapsed}
				aria-label={
					isCollapsed ? "Expand file contents" : "Collapse file contents"
				}
				title={isCollapsed ? "Expand file" : "Collapse file"}
				className="relative flex shrink-0 items-center rounded-sm after:absolute after:-inset-1.5"
			>
				<FileTypeIcon path={file.path} />
			</button>

			{moved ? (
				<>
					<span
						className={cn(
							"min-w-0 shrink truncate text-muted-foreground select-text",
							moved.name !== name && "line-through",
						)}
					>
						{moved.name !== name ? moved.name : moved.dir}
					</span>
					<span aria-hidden className="shrink-0 text-icon-faint">
						→
					</span>
				</>
			) : null}
			<span
				className={cn(
					"max-w-[60%] shrink-0 truncate select-text",
					file.status === "removed"
						? "text-muted-foreground line-through"
						: "text-foreground",
				)}
			>
				{name}
			</span>
			<span className="min-w-0 truncate text-muted-foreground select-text max-sm:hidden">
				{dir}
			</span>
			{change ? (
				<span className={cn("shrink-0 font-medium", change.tone)}>
					{change.label}
				</span>
			) : null}
			<button
				type="button"
				onClick={copyPath}
				aria-label={copied ? "Copied file path" : "Copy file path"}
				title="Copy file path"
				className="relative flex shrink-0 text-muted-foreground transition-colors after:absolute after:-inset-1.5 hover:text-foreground"
			>
				{copied ? (
					<CheckIcon size={12} strokeWidth={2.5} />
				) : (
					<CopyIcon size={12} strokeWidth={2} />
				)}
			</button>

			<span className="ml-auto" />
			{emptyLabel ? (
				<span className="shrink-0 text-muted-foreground max-sm:hidden">
					{emptyLabel}
				</span>
			) : null}
			<LineCounts
				additions={file.additions}
				deletions={file.deletions}
				className="text-xs"
			/>
			{isViewed !== undefined ? (
				<label className="ml-3 flex h-6 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground">
					<input
						type="checkbox"
						checked={isViewed}
						onChange={(e) => onViewedChange(e.target.checked)}
						className="size-3.5 cursor-pointer accent-focus"
					/>
					<span className="max-sm:sr-only">Viewed</span>
				</label>
			) : null}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<PageIconButton
						type="button"
						className="size-6 text-foreground"
						aria-label="File actions"
					>
						<MoreHorizontalIcon size={14} />
					</PageIconButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={copyPath}>
						<CopyIcon size={14} strokeWidth={2} />
						Copy file path
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onToggleCollapse}>
						{isCollapsed ? (
							<ChevronDownIcon size={14} strokeWidth={2} />
						) : (
							<ChevronUpIcon size={14} strokeWidth={2} />
						)}
						{isCollapsed ? "Expand file" : "Collapse file"}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
});
