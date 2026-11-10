import {
	memo,
	type ReactNode,
	useCallback,
	useMemo,
	useSyncExternalStore,
} from "react";
import { FileSearchCard } from "#/components/shared/file-search-card";
import { diffFileAnchorId } from "#/lib/diffs/diff-files";
import type { PullFileSummary } from "#/lib/github.types";
import { type ActiveFileStore, ReviewFileTree } from "./review-file-tree";
import type { ViewedFilesStore } from "./viewed-files-store";

/**
 * File search, the changed-files tree and a status line. Reads the active
 * file from its store, so scrolling the diff re-renders only this panel.
 * `tree` and `status` replace the default tree and file count.
 */
export const ReviewSidebar = memo(function ReviewSidebar({
	sidebarFiles,
	sidebarFileCount,
	activeFileStore,
	onFileClick,
	status,
	tree,
}: {
	sidebarFiles: PullFileSummary[];
	sidebarFileCount: number;
	activeFileStore: ActiveFileStore;
	onFileClick: (path: string) => void;
	status?: ReactNode;
	tree?: ReactNode;
}) {
	const searchEntries = useMemo(
		() =>
			sidebarFiles.map((file) => ({
				path: file.filename,
				name: file.filename.split("/").pop() ?? file.filename,
				type: "file" as const,
			})),
		[sidebarFiles],
	);

	const activeFile = useSyncExternalStore(
		activeFileStore.subscribe,
		activeFileStore.get,
	);

	const revealFile = useCallback(
		(path: string) => {
			onFileClick(path);
			const hash = `#${diffFileAnchorId(path)}`;
			if (window.location.hash !== hash) {
				history.replaceState(null, "", hash);
			}
		},
		[onFileClick],
	);
	const handleSearchSelect = useCallback(
		(entry: { path: string }) => revealFile(entry.path),
		[revealFile],
	);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<FileSearchCard
				entries={searchEntries}
				onSelect={handleSearchSelect}
				activePath={activeFile ?? undefined}
				placeholder="Search files..."
				shortcutKey="f"
			/>

			{tree ?? (
				<ReviewFileTree
					files={sidebarFiles}
					activeFileStore={activeFileStore}
					onFileClick={revealFile}
				/>
			)}

			<div className="flex h-9 shrink-0 items-center gap-2 border-t-[0.5px] border-header-rule px-4 text-xs font-[450] text-muted-foreground">
				{status ?? (
					<span className="tabular-nums">
						{sidebarFileCount} {sidebarFileCount === 1 ? "file" : "files"}{" "}
						changed
					</span>
				)}
			</div>
		</div>
	);
});

function Meter({
	label,
	value,
	total,
}: {
	label: string;
	value: number;
	total: number;
}) {
	return (
		<span
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={total}
			aria-valuenow={value}
			className="ml-auto h-1 w-16 shrink-0 overflow-hidden rounded-full bg-pill-neutral"
		>
			<span
				className="block h-full rounded-full bg-pill-ok-text transition-[width] duration-200"
				style={{ width: total > 0 ? `${(value / total) * 100}%` : 0 }}
			/>
		</span>
	);
}

export function ViewedProgress({
	viewedFiles,
	total,
}: {
	viewedFiles: ViewedFilesStore;
	total: number;
}) {
	const viewed = useSyncExternalStore(
		viewedFiles.subscribe,
		viewedFiles.count,
		() => 0,
	);
	return (
		<>
			<span className="tabular-nums">
				{viewed} of {total} viewed
			</span>
			<Meter label="Files viewed" value={viewed} total={total} />
		</>
	);
}

/** Shown while the file list is still arriving page by page. */
export function FilesLoadedProgress({
	loaded,
	total,
}: {
	loaded: number;
	total: number;
}) {
	return (
		<>
			<span className="tabular-nums">
				{loaded} of {total} files loaded
			</span>
			<Meter label="Files loaded" value={loaded} total={total} />
		</>
	);
}
