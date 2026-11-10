import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import { cn } from "@diffkit/ui/lib/utils";
import type {
	CodeViewDiffItem,
	CodeViewItem,
	CodeViewOptions,
	DiffLineAnnotation,
	SelectedLineRange,
} from "@pierre/diffs";
import {
	CodeView,
	type CodeViewHandle,
	useStableCallback,
	WorkerPoolContext,
} from "@pierre/diffs/react";
import { useTheme } from "next-themes";
import {
	createContext,
	type ReactNode,
	type Ref,
	use,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import {
	InlineCommentForm,
	PendingCommentBubble,
	ReviewCommentThread,
} from "#/components/pulls/review/review-comment-annotations";
import type {
	ActiveCommentForm,
	PendingComment,
	ReviewAnnotation,
} from "#/components/pulls/review/review-types";
import { encodeFileId } from "#/components/pulls/review/review-utils";
import type { ViewedFilesStore } from "#/components/pulls/review/viewed-files-store";
import type { DiffFile } from "#/lib/diffs/diff-files";
import {
	DIFF_HUNK_SEPARATOR_HEIGHT,
	DIFF_LINE_HEIGHT,
	DIFF_SPACING,
	DIFF_SURFACE_CSS,
} from "#/lib/diffs/diff-surface-css";
import { getDiffsRuntime } from "#/lib/diffs/diffs-runtime";
import type { PullReviewComment } from "#/lib/github.types";
import { DIFF_FILE_HEADER_HEIGHT, DiffFileHeader } from "./diff-file-header";

type Item = CodeViewDiffItem<ReviewAnnotation>;
type Annotation = DiffLineAnnotation<ReviewAnnotation>;

export type DiffReview = {
	owner: string;
	repo: string;
	pullNumber: number;
	threadsByFile: ReadonlyMap<string, DiffLineAnnotation<PullReviewComment>[]>;
	pendingCommentsByFile: ReadonlyMap<string, PendingComment[]>;
	activeCommentForm: ActiveCommentForm | null;
	selectedLines: SelectedLineRange | null;
	repliesByCommentId: ReadonlyMap<number, PullReviewComment[]>;
	threadInfoByCommentId?: ReadonlyMap<
		number,
		{ threadId: string; isResolved: boolean }
	>;
	mentionConfig?: MentionConfig;
	viewerLogin?: string;
	viewedFiles: ViewedFilesStore;
	onStartComment: (path: string, range: SelectedLineRange) => void;
	onCancelComment: () => void;
	onAddComment: (comment: PendingComment) => void;
	onEditComment: (original: PendingComment, body: string) => void;
};

export type DiffCodeViewHandle = {
	scrollToFile: (path: string) => void;
};

export type DiffCodeViewProps = {
	files: readonly DiffFile[];
	diffStyle: "unified" | "split";
	wrapLines: boolean;
	review?: DiffReview;
	onActiveFileChange?: (path: string) => void;
	header?: ReactNode;
	footer?: ReactNode;
	className?: string;
	ref?: Ref<DiffCodeViewHandle>;
};

const LAYOUT = { paddingTop: 0, paddingBottom: 48, gap: 0 };
const ITEM_METRICS = {
	diffHeaderHeight: DIFF_FILE_HEADER_HEIGHT,
	hunkSeparatorHeight: DIFF_HUNK_SEPARATOR_HEIGHT,
	lineHeight: DIFF_LINE_HEIGHT,
	spacing: DIFF_SPACING,
};
const ACTIVE_FILE_PROBE = 0.1;
/** Opt-in while tuning ITEM_METRICS against our CSS; it costs a layout read per item. */
const VALIDATE_ITEM_HEIGHTS =
	import.meta.env.DEV &&
	typeof localStorage !== "undefined" &&
	localStorage.getItem("diffkit:validate-diff-heights") === "1";
const NO_ANNOTATIONS: Annotation[] = [];

const ReviewContext = createContext<DiffReview | null>(null);

function annotationsForFile(review: DiffReview, path: string): Annotation[] {
	const threads = review.threadsByFile.get(path);
	const pending = review.pendingCommentsByFile.get(path);
	const form =
		review.activeCommentForm?.path === path ? review.activeCommentForm : null;
	if (!threads && !pending && !form) return NO_ANNOTATIONS;
	const annotations: Annotation[] = [];
	for (const thread of threads ?? []) {
		annotations.push({
			side: thread.side,
			lineNumber: thread.lineNumber,
			metadata: { kind: "thread", comment: thread.metadata },
		});
	}
	for (const comment of pending ?? []) {
		annotations.push({
			side: comment.side === "LEFT" ? "deletions" : "additions",
			lineNumber: comment.line,
			metadata: { kind: "pending", comment },
		});
	}
	if (form) {
		annotations.push({
			side: form.side === "LEFT" ? "deletions" : "additions",
			lineNumber: form.line,
			metadata: { kind: "draft", form },
		});
	}
	return annotations;
}

function annotationSubject(annotation: Annotation) {
	const { metadata } = annotation;
	switch (metadata.kind) {
		case "thread":
		case "pending":
			return metadata.comment;
		case "draft":
			return metadata.form;
	}
}

function sameAnnotations(a: readonly Annotation[], b: readonly Annotation[]) {
	if (a.length !== b.length) return false;
	return a.every(
		(annotation, index) =>
			annotationSubject(annotation) === annotationSubject(b[index]),
	);
}

function ReviewAnnotationSlot({
	annotation,
	path,
}: {
	annotation: Annotation;
	path: string;
}) {
	const review = use(ReviewContext);
	if (!review) return null;
	const { metadata } = annotation;
	switch (metadata.kind) {
		case "thread":
			return (
				<ReviewCommentThread
					comment={metadata.comment}
					replies={review.repliesByCommentId.get(metadata.comment.id)}
					owner={review.owner}
					repo={review.repo}
					pullNumber={review.pullNumber}
					viewerLogin={review.viewerLogin}
					threadInfo={review.threadInfoByCommentId?.get(metadata.comment.id)}
				/>
			);
		case "pending":
			return (
				<PendingCommentBubble
					comment={metadata.comment}
					onEdit={review.onEditComment}
					mentionConfig={review.mentionConfig}
				/>
			);
		case "draft": {
			const { form } = metadata;
			return (
				<InlineCommentForm
					isMultiLine={form.startLine != null && form.startLine !== form.line}
					startLine={form.startLine}
					endLine={form.line}
					onSubmit={(body) => review.onAddComment({ ...form, path, body })}
					onCancel={review.onCancelComment}
					mentionConfig={review.mentionConfig}
				/>
			);
		}
	}
}

const NO_VIEWED_FILES = {
	subscribe: () => () => undefined,
	has: () => false,
};

function ItemHeader({
	file,
	collapsed,
	viewedFiles,
	onToggleCollapsed,
	onViewedChange,
}: {
	file: DiffFile;
	collapsed: boolean;
	viewedFiles: ViewedFilesStore | undefined;
	onToggleCollapsed: (path: string) => void;
	onViewedChange: (path: string, viewed: boolean) => void;
}) {
	const store = viewedFiles ?? NO_VIEWED_FILES;
	const viewed = useSyncExternalStore(
		store.subscribe,
		() => store.has(file.path),
		() => false,
	);
	return (
		<DiffFileHeader
			file={file}
			isCollapsed={collapsed}
			onToggleCollapse={() => onToggleCollapsed(file.path)}
			className="border-b-[0.5px]"
			isViewed={viewedFiles ? viewed : undefined}
			onViewedChange={(value) => onViewedChange(file.path, value)}
		/>
	);
}

function DiffCodeViewSurface({
	files,
	diffStyle,
	wrapLines,
	review,
	onActiveFileChange,
	header,
	footer,
	className,
	ref,
}: DiffCodeViewProps) {
	const runtime = getDiffsRuntime();
	const viewerRef = useRef<CodeViewHandle<ReviewAnnotation, undefined>>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const viewedFiles = review?.viewedFiles;
	const { resolvedTheme } = useTheme();

	const filesById = useRef(new Map<string, DiffFile>()).current;
	const idByHash = useRef(new Map<string, string>()).current;
	const appliedAnnotations = useRef(new Map<string, Annotation[]>()).current;
	const addedCount = useRef(0);
	/** The `#diff-…` id of a file asked for before it streamed in. */
	const pendingReveal = useRef<string | null>(null);
	const activeFile = useRef<string | null>(null);

	const createItem = (file: DiffFile): Item => {
		filesById.set(file.path, file);
		idByHash.set(encodeFileId(file.path), file.path);
		const annotations = review
			? annotationsForFile(review, file.path)
			: NO_ANNOTATIONS;
		appliedAnnotations.set(file.path, annotations);
		return {
			id: file.path,
			type: "diff",
			fileDiff: file.fileDiff,
			annotations,
			collapsed: file.status === "removed",
			version: 0,
		};
	};

	const [initialItems] = useState(() => {
		addedCount.current = files.length;
		return files.map(createItem);
	});

	const updateItem = (id: string, change: (item: Item) => void) => {
		const viewer = viewerRef.current;
		const item = viewer?.getItem(id);
		if (!viewer || !item || item.type !== "diff") return;
		change(item);
		item.version = (item.version ?? 0) + 1;
		viewer.updateItem(item);
	};

	const scrollToFile = useStableCallback((path: string) => {
		const viewer = viewerRef.current;
		if (!viewer?.getItem(path)) {
			pendingReveal.current = encodeFileId(path);
			return;
		}
		pendingReveal.current = null;
		updateItem(path, (item) => {
			item.collapsed = false;
		});
		viewer.scrollTo({ type: "item", id: path, align: "start" });
		const hash = `#${encodeFileId(path)}`;
		if (window.location.hash !== hash) history.replaceState(null, "", hash);
		activeFile.current = path;
		onActiveFileChange?.(path);
	});

	useImperativeHandle(ref, () => ({ scrollToFile }), [scrollToFile]);

	useEffect(() => {
		const viewer = viewerRef.current;
		if (!viewer || files.length <= addedCount.current) return;
		const added = files.slice(addedCount.current).map(createItem);
		addedCount.current = files.length;
		viewer.addItems(added);
		const target = pendingReveal.current && idByHash.get(pendingReveal.current);
		if (target) scrollToFile(target);
	});

	useEffect(() => {
		if (!review) return;
		for (const path of filesById.keys()) {
			const next = annotationsForFile(review, path);
			const previous = appliedAnnotations.get(path) ?? NO_ANNOTATIONS;
			if (sameAnnotations(previous, next)) continue;
			appliedAnnotations.set(path, next);
			updateItem(path, (item) => {
				item.annotations = next;
			});
		}
	});

	const selectionPath = review?.activeCommentForm?.path;
	const selectedRange = review?.selectedLines ?? null;
	useEffect(() => {
		const viewer = viewerRef.current;
		if (!viewer) return;
		if (selectionPath && selectedRange) {
			viewer.setSelectedLines({ id: selectionPath, range: selectedRange });
		} else {
			viewer.clearSelectedLines();
		}
	}, [selectionPath, selectedRange]);

	useEffect(() => {
		const revealHash = () => {
			const id = window.location.hash.slice(1);
			if (!id) return;
			const path = idByHash.get(id);
			if (path) scrollToFile(path);
			else pendingReveal.current = id;
		};
		revealHash();
		window.addEventListener("hashchange", revealHash);
		return () => window.removeEventListener("hashchange", revealHash);
	}, [idByHash, scrollToFile]);

	const toggleCollapsed = useStableCallback((path: string) => {
		const viewer = viewerRef.current;
		const instance = viewer?.getInstance();
		if (!viewer || !instance) return;
		const top = instance.getTopForItem(path);
		updateItem(path, (item) => {
			item.collapsed = !item.collapsed;
		});
		if (top != null && top < instance.getScrollTop()) {
			viewer.scrollTo({ type: "item", id: path, align: "start" });
		}
	});

	const setViewed = useStableCallback((path: string, viewed: boolean) => {
		viewedFiles?.set(path, viewed);
		const item = viewerRef.current?.getItem(path);
		if (item && (item.collapsed === true) !== viewed) toggleCollapsed(path);
	});

	const trackActiveFile = useStableCallback((scrollTop: number) => {
		const viewer = viewerRef.current;
		const instance = viewer?.getInstance();
		const container = containerRef.current;
		if (!instance || !container) return;
		const probe = scrollTop + container.clientHeight * ACTIVE_FILE_PROBE;
		let current: string | null = null;
		let currentTop = Number.NEGATIVE_INFINITY;
		for (const rendered of instance.getRenderedItems()) {
			const top = instance.getTopForItem(rendered.id);
			if (top != null && top <= probe && top > currentTop) {
				current = rendered.id;
				currentTop = top;
			}
		}
		if (current && current !== activeFile.current) {
			activeFile.current = current;
			onActiveFileChange?.(current);
		}
	});

	const frame = useRef(0);
	const handleScroll = useStableCallback((scrollTop: number) => {
		if (frame.current) return;
		frame.current = requestAnimationFrame(() => {
			frame.current = 0;
			trackActiveFile(scrollTop);
		});
	});
	useEffect(() => () => cancelAnimationFrame(frame.current), []);

	const startComment = useStableCallback(
		(range: SelectedLineRange, path: string) => {
			review?.onStartComment(path, range);
		},
	);

	const reviewable = review !== undefined;
	const themeType = resolvedTheme === "dark" ? "dark" : "light";
	const options = useMemo(
		(): CodeViewOptions<ReviewAnnotation, undefined> => ({
			theme: runtime.themes,
			preferredHighlighter: runtime.highlighter,
			themeType,
			diffStyle,
			overflow: wrapLines ? "wrap" : "scroll",
			diffIndicators: "bars",
			hunkSeparators: "line-info",
			lineHoverHighlight: "number",
			stickyHeaders: true,
			layout: LAYOUT,
			itemMetrics: ITEM_METRICS,
			enableLineSelection: reviewable,
			enableGutterUtility: reviewable,
			onGutterUtilityClick(range, context) {
				startComment(range, context.item.id);
			},
			unsafeCSS: DIFF_SURFACE_CSS,
			__devOnlyValidateItemHeights: VALIDATE_ITEM_HEIGHTS,
		}),
		[runtime, themeType, diffStyle, wrapLines, reviewable, startComment],
	);

	const renderHeader = useStableCallback(
		(item: CodeViewItem<ReviewAnnotation>) => {
			const file = filesById.get(item.id);
			if (!file) return null;
			return (
				<ItemHeader
					file={file}
					collapsed={item.collapsed === true}
					viewedFiles={viewedFiles}
					onToggleCollapsed={toggleCollapsed}
					onViewedChange={setViewed}
				/>
			);
		},
	);

	const renderAnnotation = useStableCallback(
		(
			annotation: Annotation | { metadata?: unknown },
			_diff: unknown,
			item: CodeViewItem<ReviewAnnotation>,
		) =>
			"side" in annotation ? (
				<ReviewAnnotationSlot
					annotation={annotation as Annotation}
					path={item.id}
				/>
			) : null,
	);

	return (
		<WorkerPoolContext.Provider value={runtime.pool}>
			<ReviewContext.Provider value={review ?? null}>
				<CodeView<ReviewAnnotation, undefined>
					ref={viewerRef}
					containerRef={containerRef}
					initialItems={initialItems}
					options={options}
					onScroll={handleScroll}
					renderCustomHeader={renderHeader}
					renderAnnotation={renderAnnotation}
					renderCodeViewHeader={header ? () => header : undefined}
					renderCodeViewFooter={footer ? () => footer : undefined}
					className={cn(
						"relative h-full min-h-0 min-w-0 overflow-x-clip overflow-y-auto overscroll-contain [contain:strict] [overflow-anchor:none] [will-change:scroll-position]",
						"[&_diffs-container]:overflow-clip [&_diffs-container]:bg-main [&_diffs-container]:[--diff-file-end-rule:var(--color-header-rule)] [&_diffs-container]:[contain:layout_paint_style]",
						className,
					)}
				/>
			</ReviewContext.Provider>
		</WorkerPoolContext.Provider>
	);
}

export function DiffCodeView(props: DiffCodeViewProps & { revision: string }) {
	const { revision, ...rest } = props;
	return <DiffCodeViewSurface key={revision} {...rest} />;
}
