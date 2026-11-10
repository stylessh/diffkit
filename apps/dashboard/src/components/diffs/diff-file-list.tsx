import { type VirtualFileMetrics, Virtualizer } from "@pierre/diffs";
import {
	FileDiff,
	VirtualizerContext,
	WorkerPoolContext,
} from "@pierre/diffs/react";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type DiffFile, diffFileAnchorId } from "#/lib/diffs/diff-files";
import {
	DIFF_HUNK_SEPARATOR_HEIGHT,
	DIFF_LINE_HEIGHT,
	DIFF_SPACING,
} from "#/lib/diffs/diff-surface-css";
import { getDiffsRuntime } from "#/lib/diffs/diffs-runtime";
import {
	type DiffStyle,
	useDiffSurfaceOptions,
} from "#/lib/diffs/use-diff-options";
import { DiffFileHeader } from "./diff-file-header";

export const DIFF_SCROLL_ROOT_ATTRIBUTE = "data-diffs-scroll-root";
export const DIFF_SCROLL_CONTENT_ATTRIBUTE = "data-diffs-scroll-content";

const METRICS: VirtualFileMetrics = {
	hunkLineCount: 50,
	lineHeight: DIFF_LINE_HEIGHT,
	diffHeaderHeight: 0,
	hunkSeparatorHeight: DIFF_HUNK_SEPARATOR_HEIGHT,
	spacing: DIFF_SPACING,
};

export type DiffFileListProps = {
	files: readonly DiffFile[];
	diffStyle: DiffStyle;
	wrapLines: boolean;
};

/**
 * Diffs inside a page that already scrolls (compare): a Pierre `Virtualizer`
 * is attached to the page's scroll root instead of owning a scroller, so the
 * server-rendered layout around the diffs stays untouched.
 */
export function DiffFileList({
	files,
	diffStyle,
	wrapLines,
}: DiffFileListProps) {
	const runtime = getDiffsRuntime();
	const anchorRef = useRef<HTMLDivElement>(null);
	const [virtualizer, setVirtualizer] = useState<Virtualizer>();

	useLayoutEffect(() => {
		const anchor = anchorRef.current;
		const root = anchor?.closest<HTMLElement>(
			`[${DIFF_SCROLL_ROOT_ATTRIBUTE}]`,
		);
		if (!root) return;
		const content =
			root.querySelector(`[${DIFF_SCROLL_CONTENT_ATTRIBUTE}]`) ?? undefined;
		const instance = new Virtualizer();
		instance.setup(root, content);
		setVirtualizer(instance);
		return () => instance.cleanUp();
	}, []);

	return (
		<div ref={anchorRef} className="flex flex-col gap-2">
			{virtualizer ? (
				<WorkerPoolContext.Provider value={runtime.pool}>
					<VirtualizerContext.Provider value={virtualizer}>
						{files.map((file) => (
							<DiffFileCard
								key={file.path}
								file={file}
								diffStyle={diffStyle}
								wrapLines={wrapLines}
							/>
						))}
					</VirtualizerContext.Provider>
				</WorkerPoolContext.Provider>
			) : null}
		</div>
	);
}

const DiffFileCard = memo(function DiffFileCard({
	file,
	diffStyle,
	wrapLines,
}: {
	file: DiffFile;
	diffStyle: DiffStyle;
	wrapLines: boolean;
}) {
	const [collapsed, setCollapsed] = useState(file.status === "removed");
	const surface = useDiffSurfaceOptions({ diffStyle, wrapLines });
	const options = useMemo(
		() => ({ ...surface, disableFileHeader: true }),
		[surface],
	);

	return (
		<section
			id={diffFileAnchorId(file.path)}
			aria-label={file.path}
			className="overflow-clip rounded-lg border-[0.5px] border-card-border bg-main"
		>
			<div className="sticky top-0 z-10">
				<DiffFileHeader
					file={file}
					isCollapsed={collapsed}
					onToggleCollapse={() => setCollapsed((value) => !value)}
					onViewedChange={() => undefined}
				/>
			</div>
			{collapsed || file.content !== "hunks" ? null : (
				<FileDiff
					fileDiff={file.fileDiff}
					options={options}
					metrics={METRICS}
				/>
			)}
		</section>
	);
});
