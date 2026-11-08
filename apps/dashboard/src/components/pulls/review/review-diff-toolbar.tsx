import {
	CommentIcon,
	DisplayOptionsIcon,
	FileIcon,
	GitCommitIcon,
} from "@diffkit/icons";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { Switch } from "@diffkit/ui/components/switch";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useId } from "react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { PullCommit } from "#/lib/github.types";
import { SplitDiffGlyph, UnifiedDiffGlyph } from "./review-icons";

export type DiffView = "files" | "commits";
export type DiffStyle = "unified" | "split";

/**
 * The 36px bar above a diff's file cards, after Linear's Diff tab: Files and
 * Commits on the left, the comment count and display options on the right.
 */
export function DiffToolbar({
	view,
	onViewChange,
	fileCount,
	commitCount,
	commentCount,
	diffStyle,
	onDiffStyleChange,
	wrapLines,
	onWrapLinesChange,
	leading,
}: {
	view: DiffView;
	onViewChange: (view: DiffView) => void;
	fileCount: number;
	commitCount: number;
	commentCount?: number;
	diffStyle: DiffStyle;
	onDiffStyleChange: (style: DiffStyle) => void;
	wrapLines: boolean;
	onWrapLinesChange: (wrap: boolean) => void;
	/** Rendered before the tabs (the file tree button on small screens). */
	leading?: ReactNode;
}) {
	return (
		<div className="flex h-9 shrink-0 items-center gap-1 rounded-lg border-[0.5px] border-card-border bg-surface-0 pr-1.5 pl-3 text-xs leading-4">
			{leading}
			<DiffToolbarTab
				active={view === "files"}
				onClick={() => onViewChange("files")}
			>
				<FileIcon size={14} strokeWidth={2} />
				Files
				<span className="font-medium tabular-nums text-icon-faint">
					{fileCount}
				</span>
			</DiffToolbarTab>
			<DiffToolbarTab
				active={view === "commits"}
				onClick={() => onViewChange("commits")}
			>
				<GitCommitIcon size={14} strokeWidth={2} />
				Commits
				<span className="tabular-nums text-icon-faint">{commitCount}</span>
			</DiffToolbarTab>
			<span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
				{commentCount != null && commentCount > 0 ? (
					<span
						className="flex items-center gap-1.5 tabular-nums"
						title={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
					>
						<CommentIcon size={14} strokeWidth={2} />
						{commentCount}
						<span className="sr-only">
							{commentCount === 1 ? "comment" : "comments"}
						</span>
					</span>
				) : null}
				<span className="ml-1.5 flex">
					<DiffDisplayOptions
						diffStyle={diffStyle}
						onDiffStyleChange={onDiffStyleChange}
						wrapLines={wrapLines}
						onWrapLinesChange={onWrapLinesChange}
					/>
				</span>
			</span>
		</div>
	);
}

function DiffToolbarTab({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"flex h-6 items-center gap-1.5 rounded-full px-1.5 transition-colors [&_svg]:shrink-0",
				active
					? "font-[450] text-text-header"
					: "font-medium text-muted-foreground hover:text-text-header",
			)}
		>
			{children}
		</button>
	);
}

/** The sliders button and its popover: Split | Unified, then Wrap lines. */
function DiffDisplayOptions({
	diffStyle,
	onDiffStyleChange,
	wrapLines,
	onWrapLinesChange,
}: {
	diffStyle: DiffStyle;
	onDiffStyleChange: (style: DiffStyle) => void;
	wrapLines: boolean;
	onWrapLinesChange: (wrap: boolean) => void;
}) {
	const wrapId = useId();
	const side = (id: DiffStyle, label: string, glyph: ReactNode) => (
		<button
			type="button"
			aria-pressed={diffStyle === id}
			onClick={() => onDiffStyleChange(id)}
			className={cn(
				"flex h-[27px] flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium transition-colors",
				diffStyle === id
					? "bg-tab-selected text-foreground shadow-tab-selected"
					: "bg-button text-muted-foreground shadow-button hover:bg-button-hover hover:text-foreground",
			)}
		>
			{glyph}
			{label}
		</button>
	);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<PageIconButton
					type="button"
					className="size-6"
					aria-label="Display options"
					title="Display options"
				>
					<DisplayOptionsIcon size={14} />
				</PageIconButton>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[299px] p-0 pt-4 pb-2">
				<div className="mx-[18px] mb-[11.5px] flex gap-1">
					{side("split", "Split", <SplitDiffGlyph />)}
					{side("unified", "Unified", <UnifiedDiffGlyph />)}
				</div>
				<div className="px-4">
					<div className="flex h-8 items-center gap-2">
						<label
							htmlFor={wrapId}
							className="flex-1 cursor-pointer text-xs font-[450] text-muted-foreground"
						>
							Wrap lines
						</label>
						<Switch
							id={wrapId}
							checked={wrapLines}
							onCheckedChange={onWrapLinesChange}
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

/** The branch's commits as a card of 40px rows, for the toolbar's Commits view. */
export function DiffCommitList({
	commits,
	owner,
	repo,
}: {
	commits: PullCommit[];
	owner: string;
	repo: string;
}) {
	if (commits.length === 0) {
		return (
			<p className="px-4 py-8 text-center text-[13px] font-[450] text-muted-foreground">
				No commits yet.
			</p>
		);
	}

	return (
		<ol className="overflow-hidden rounded-lg border-[0.5px] border-card-border bg-surface-0">
			{commits.map((commit, i) => {
				const firstLine = commit.message.split("\n")[0];
				return (
					<li
						key={commit.sha}
						className={cn(
							"flex h-10 items-center gap-2.5 px-4 text-[13px]",
							i > 0 && "border-t-[0.5px] border-card-border",
						)}
					>
						<GitCommitIcon
							size={14}
							strokeWidth={2}
							className="shrink-0 text-muted-foreground"
						/>
						<Link
							to="/$owner/$repo/commit/$sha"
							params={{ owner, repo, sha: commit.sha }}
							className="min-w-0 flex-1 truncate font-[450] text-foreground hover:underline"
						>
							{firstLine}
						</Link>
						{commit.author ? (
							<img
								src={commit.author.avatarUrl}
								alt={commit.author.login}
								title={commit.author.login}
								className="size-4 shrink-0 rounded-full"
							/>
						) : null}
						<code className="shrink-0 font-mono text-[11px] text-icon-faint">
							{commit.sha.slice(0, 7)}
						</code>
						{commit.createdAt ? (
							<span className="w-14 shrink-0 text-right text-xs font-[450] text-muted-foreground max-sm:hidden">
								{formatRelativeTime(commit.createdAt)}
							</span>
						) : null}
					</li>
				);
			})}
		</ol>
	);
}
