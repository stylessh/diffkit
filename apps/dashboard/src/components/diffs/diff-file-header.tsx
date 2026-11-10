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
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import type {
	DiffFileContent,
	DiffFileStatus,
	DiffFileSummary,
} from "#/lib/diffs/diff-files";

/** The virtualized code view sizes rows from this; it must equal `h-10`. */
export const DIFF_FILE_HEADER_HEIGHT = 40;

const CHANGE_LABEL: Partial<
	Record<DiffFileStatus, { label: string; tone: string }>
> = {
	added: { label: "New", tone: "bg-pill-ok text-pill-ok-text" },
	removed: { label: "Deleted", tone: "bg-pill-blocked text-pill-blocked-text" },
	renamed: { label: "Renamed", tone: "bg-pill-neutral text-muted-foreground" },
};

const EMPTY_CONTENT_LABEL: Record<DiffFileContent, string | null> = {
	hunks: null,
	"pure-rename": "No content changes",
	none: "Binary or too large to display",
};

function splitPath(path: string) {
	const at = path.lastIndexOf("/");
	return { name: path.slice(at + 1), dir: path.slice(0, at + 1) };
}

function ChangeRatio({
	additions,
	deletions,
}: {
	additions: number;
	deletions: number;
}) {
	const total = additions + deletions;
	if (total === 0) return null;
	return (
		<span
			aria-hidden
			className="flex h-1 w-9 shrink-0 gap-px overflow-hidden rounded-full max-sm:hidden"
		>
			<span className="bg-added" style={{ flexGrow: additions }} />
			<span className="bg-removed" style={{ flexGrow: deletions }} />
		</span>
	);
}

export const DiffFileHeader = memo(function DiffFileHeader({
	file,
	isCollapsed,
	onToggleCollapse,
	isViewed,
	onViewedChange,
	className,
}: {
	file: DiffFileSummary;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	isViewed?: boolean;
	onViewedChange: (viewed: boolean) => void;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	const { name, dir } = splitPath(file.path);
	const moved = file.previousPath ? splitPath(file.previousPath) : null;
	const change = CHANGE_LABEL[file.status];
	const emptyLabel = EMPTY_CONTENT_LABEL[file.content];

	const copyPath = useCallback(() => {
		void navigator.clipboard.writeText(file.path).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}, [file.path]);

	return (
		<div
			className={cn(
				"flex h-10 items-center gap-2 border-header-rule bg-main pr-2 pl-2 text-xs leading-4 font-[450] select-none",
				!isCollapsed && "border-b-[0.5px]",
				className,
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
				className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
			>
				<ChevronDownIcon
					size={14}
					strokeWidth={2}
					className={cn(
						"transition-transform duration-150",
						isCollapsed && "-rotate-90",
					)}
				/>
			</button>
			<FileTypeIcon path={file.path} />

			<span className="flex min-w-0 shrink items-center font-mono text-[12px] select-text">
				{moved ? (
					<>
						<span
							className={cn(
								"min-w-0 shrink truncate text-muted-foreground",
								moved.name !== name && "line-through",
							)}
						>
							{moved.name !== name ? moved.name : moved.dir}
						</span>
						<span aria-hidden className="mx-1.5 shrink-0 text-icon-faint">
							→
						</span>
					</>
				) : null}
				<span className="min-w-0 shrink-[99] truncate text-muted-foreground max-sm:hidden">
					{dir}
				</span>
				<span
					className={cn(
						"min-w-0 truncate font-medium",
						file.status === "removed"
							? "text-muted-foreground line-through"
							: "text-foreground",
					)}
				>
					{name}
				</span>
			</span>
			{change ? (
				<span
					className={cn(
						"flex h-[18px] shrink-0 items-center rounded-full px-1.5 text-[11px] font-medium",
						change.tone,
					)}
				>
					{change.label}
				</span>
			) : null}
			<button
				type="button"
				onClick={copyPath}
				aria-label={copied ? "Copied file path" : "Copy file path"}
				title="Copy file path"
				className="relative flex shrink-0 text-icon-faint transition-colors after:absolute after:-inset-1.5 hover:text-foreground"
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
			<ChangeRatio additions={file.additions} deletions={file.deletions} />
			<LineCounts
				additions={file.additions}
				deletions={file.deletions}
				className="font-mono text-[11.5px]"
			/>
			{isViewed !== undefined ? (
				<label
					className={cn(
						"relative ml-2 flex h-6 shrink-0 items-center gap-1.5 rounded-full pr-2.5 pl-1.5 font-medium transition-colors has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-ring",
						isViewed
							? "bg-pill-ok text-pill-ok-text"
							: "bg-chip text-muted-foreground shadow-chip hover:text-foreground",
					)}
				>
					<input
						type="checkbox"
						checked={isViewed}
						onChange={(e) => onViewedChange(e.target.checked)}
						className="absolute inset-0 size-full cursor-pointer opacity-0"
					/>
					<span
						aria-hidden
						className={cn(
							"flex size-3.5 items-center justify-center rounded-full",
							isViewed
								? "bg-pill-ok-text text-main"
								: "border border-icon-faint",
						)}
					>
						{isViewed ? <CheckIcon size={10} strokeWidth={3} /> : null}
					</span>
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
