import { type VirtualFileMetrics, Virtualizer } from "@pierre/diffs";
import {
	FileDiff,
	VirtualizerContext,
	WorkerPoolContext,
} from "@pierre/diffs/react";
import { useTheme } from "next-themes";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { encodeFileId } from "#/components/pulls/review/review-utils";
import type { DiffFile } from "#/lib/diffs/diff-files";
import {
	DIFF_HUNK_SEPARATOR_HEIGHT,
	DIFF_LINE_HEIGHT,
	DIFF_SPACING,
	DIFF_SURFACE_CSS,
} from "#/lib/diffs/diff-surface-css";
import { getDiffsRuntime } from "#/lib/diffs/diffs-runtime";
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
	diffStyle: "unified" | "split";
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
	diffStyle: "unified" | "split";
	wrapLines: boolean;
}) {
	const runtime = getDiffsRuntime();
	const { resolvedTheme } = useTheme();
	const [collapsed, setCollapsed] = useState(file.status === "removed");
	const hasContent = file.fileDiff.hunks.length > 0;
	const options = useMemo(
		() => ({
			theme: runtime.themes,
			preferredHighlighter: runtime.highlighter,
			themeType:
				resolvedTheme === "dark" ? ("dark" as const) : ("light" as const),
			diffStyle,
			overflow: wrapLines ? ("wrap" as const) : ("scroll" as const),
			diffIndicators: "bars" as const,
			hunkSeparators: "line-info" as const,
			disableFileHeader: true,
			unsafeCSS: DIFF_SURFACE_CSS,
		}),
		[runtime, resolvedTheme, diffStyle, wrapLines],
	);

	return (
		<section
			id={encodeFileId(file.path)}
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
			{collapsed || !hasContent ? null : (
				<FileDiff
					fileDiff={file.fileDiff}
					options={options}
					metrics={METRICS}
				/>
			)}
		</section>
	);
});
