import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import type { PullFile, PullReviewComment } from "#/lib/github.types";
import { ReviewFileDiffBlock } from "./review-file-diff-block";
import type { ActiveCommentForm, PendingComment } from "./review-types";
import { encodeFileId } from "./review-utils";

const INITIAL_VISIBLE_COUNT = 12;
const LOAD_MORE_CHUNK = 12;
const SCROLL_TARGET_BUFFER = 6;
const EMPTY_ANNOTATIONS: DiffLineAnnotation<PullReviewComment>[] = [];
const EMPTY_PENDING_COMMENTS: PendingComment[] = [];

export type ReviewDiffPaneHandle = {
	scrollToFile: (filename: string) => void;
};

type ReviewDiffPaneProps = {
	files: PullFile[];
	totalFileCount: number;
	diffStyle: "unified" | "split";
	annotationsByFile: ReadonlyMap<
		string,
		DiffLineAnnotation<PullReviewComment>[]
	>;
	repliesByCommentId: ReadonlyMap<number, PullReviewComment[]>;
	owner: string;
	repo: string;
	pullNumber: number;
	pendingCommentsByFile: ReadonlyMap<string, PendingComment[]>;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	onLoadMore: () => void;
	activeCommentForm: ActiveCommentForm | null;
	selectedLines: SelectedLineRange | null;
	onActiveFileChange: (filename: string) => void;
	onStartComment: (filename: string, range: SelectedLineRange) => void;
	onCancelComment: () => void;
	onAddComment: (comment: PendingComment) => void;
	onEditComment: (original: PendingComment, newBody: string) => void;
	mentionConfig?: MentionConfig;
	viewerLogin?: string;
	threadInfoByCommentId?: ReadonlyMap<
		number,
		{ threadId: string; isResolved: boolean }
	>;
};

export const ReviewDiffPane = memo(
	forwardRef<ReviewDiffPaneHandle, ReviewDiffPaneProps>(function ReviewDiffPane(
		{
			files,
			totalFileCount,
			diffStyle,
			annotationsByFile,
			repliesByCommentId,
			owner,
			repo,
			pullNumber,
			pendingCommentsByFile,
			hasNextPage,
			isFetchingNextPage,
			onLoadMore,
			activeCommentForm,
			selectedLines,
			onActiveFileChange,
			onStartComment,
			onCancelComment,
			onAddComment,
			onEditComment,
			mentionConfig,
			viewerLogin,
			threadInfoByCommentId,
		},
		ref,
	) {
		const diffPanelRef = useRef<HTMLDivElement>(null);
		const loadMoreRef = useRef<HTMLDivElement>(null);
		const [visibleCount, setVisibleCount] = useState(() =>
			Math.min(files.length, INITIAL_VISIBLE_COUNT),
		);
		const [scrollTarget, setScrollTarget] = useState<string | null>(null);

		useEffect(() => {
			setVisibleCount((previous) =>
				Math.min(
					files.length,
					Math.max(files.length === 0 ? 0 : INITIAL_VISIBLE_COUNT, previous),
				),
			);
		}, [files.length]);

		const revealFile = useCallback(
			(filename: string) => {
				const targetIndex = files.findIndex(
					(file) => file.filename === filename,
				);
				if (targetIndex === -1) {
					setScrollTarget(filename);
					if (hasNextPage && !isFetchingNextPage) {
						onLoadMore();
					}
					return;
				}

				setScrollTarget(filename);
				setVisibleCount((previous) =>
					Math.min(
						files.length,
						Math.max(previous, targetIndex + 1 + SCROLL_TARGET_BUFFER),
					),
				);
			},
			[files, hasNextPage, isFetchingNextPage, onLoadMore],
		);

		const handleHash = useCallback(() => {
			if (typeof window === "undefined") return;

			const hash = window.location.hash.slice(1);
			if (!hash) return;

			// Set as scroll target — the scroll target effect handles finding
			// the element, expanding visibleCount, and fetching more pages
			setScrollTarget(hash);
		}, []);

		useImperativeHandle(
			ref,
			() => ({
				scrollToFile: revealFile,
			}),
			[revealFile],
		);

		useEffect(() => {
			handleHash();
			window.addEventListener("hashchange", handleHash);

			return () => window.removeEventListener("hashchange", handleHash);
		}, [handleHash]);

		useEffect(() => {
			if (!scrollTarget) return;

			// scrollTarget may be a filename or an already-encoded hash id
			// Try to find the file in loaded data and expand visibleCount to include it
			const targetIndex = files.findIndex(
				(file) =>
					file.filename === scrollTarget ||
					encodeFileId(file.filename) === scrollTarget,
			);

			if (targetIndex !== -1) {
				const needed = targetIndex + 1 + SCROLL_TARGET_BUFFER;
				if (needed > visibleCount) {
					setVisibleCount(Math.min(files.length, needed));
					return; // will re-run once visibleCount updates and element is in DOM
				}
			}

			const frameId = requestAnimationFrame(() => {
				const encodedId = encodeFileId(scrollTarget);
				const element =
					document.getElementById(encodedId) ??
					document.getElementById(scrollTarget);
				if (!element) {
					if (hasNextPage && !isFetchingNextPage) {
						onLoadMore();
						return;
					}

					if (!hasNextPage) {
						setScrollTarget(null);
					}
					return;
				}

				element.scrollIntoView({ block: "start" });
				const filename = element.getAttribute("data-filename");
				if (filename) {
					onActiveFileChange(filename);
					const hash = `#${encodeFileId(filename)}`;
					if (window.location.hash !== hash) {
						history.replaceState(null, "", hash);
					}
				}
				setScrollTarget(null);
			});
			return () => cancelAnimationFrame(frameId);
		}, [
			files,
			hasNextPage,
			isFetchingNextPage,
			onActiveFileChange,
			onLoadMore,
			scrollTarget,
			visibleCount,
		]);

		useEffect(() => {
			const panel = diffPanelRef.current;
			const sentinel = loadMoreRef.current;
			if (
				!panel ||
				!sentinel ||
				(visibleCount >= files.length && (!hasNextPage || isFetchingNextPage))
			) {
				return;
			}

			const observer = new IntersectionObserver(
				(entries) => {
					if (!entries[0]?.isIntersecting) return;

					if (visibleCount < files.length) {
						setVisibleCount((previous) =>
							Math.min(files.length, previous + LOAD_MORE_CHUNK),
						);
						return;
					}

					if (hasNextPage && !isFetchingNextPage) {
						onLoadMore();
					}
				},
				{
					root: panel,
					rootMargin: "3000px 0px",
					threshold: 0,
				},
			);

			observer.observe(sentinel);
			return () => observer.disconnect();
		}, [
			files.length,
			hasNextPage,
			isFetchingNextPage,
			onLoadMore,
			visibleCount,
		]);

		const visibleFiles = useMemo(
			() => files.slice(0, visibleCount),
			[files, visibleCount],
		);

		// Single shared observer for active file tracking
		useEffect(() => {
			const panel = diffPanelRef.current;
			if (!panel || visibleFiles.length === 0) return;

			const observer = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;

						const filename = entry.target.getAttribute("data-filename");
						if (filename) {
							onActiveFileChange(filename);
						}
					}
				},
				{
					root: panel,
					rootMargin: "-10% 0px -80% 0px",
					threshold: 0,
				},
			);

			for (const file of visibleFiles) {
				const element = document.getElementById(encodeFileId(file.filename));
				if (element) observer.observe(element);
			}

			return () => observer.disconnect();
		}, [onActiveFileChange, visibleFiles]);

		// Single shared observer for viewport proximity — controls when diff content mounts
		const [nearViewportFiles, setNearViewportFiles] = useState<Set<string>>(
			() => new Set(),
		);

		// Seed the first visible files as near-viewport immediately.
		// During client-side navigation the scroll container may not have its
		// final dimensions when the IntersectionObserver first checks, causing
		// all diffs to remain as empty placeholders until a hard refresh.
		useEffect(() => {
			if (visibleFiles.length === 0 || nearViewportFiles.size > 0) return;
			setNearViewportFiles(
				new Set(visibleFiles.slice(0, 4).map((f) => f.filename)),
			);
		}, [visibleFiles, nearViewportFiles.size]);

		useEffect(() => {
			const panel = diffPanelRef.current;
			if (!panel || visibleFiles.length === 0) return;

			const observer = new IntersectionObserver(
				(entries) => {
					const newlyVisible: string[] = [];
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						const filename = entry.target.getAttribute("data-filename");
						if (filename) {
							newlyVisible.push(filename);
							observer.unobserve(entry.target);
						}
					}
					if (newlyVisible.length > 0) {
						setNearViewportFiles((prev) => {
							const next = new Set(prev);
							for (const f of newlyVisible) next.add(f);
							return next;
						});
					}
				},
				{
					root: panel,
					rootMargin: "1500px 0px",
					threshold: 0,
				},
			);

			for (const file of visibleFiles) {
				if (nearViewportFiles.has(file.filename)) continue;
				const element = document.getElementById(encodeFileId(file.filename));
				if (element) observer.observe(element);
			}

			return () => observer.disconnect();
		}, [visibleFiles, nearViewportFiles]);

		if (totalFileCount === 0 && !hasNextPage) {
			return (
				<div className="flex h-full items-center justify-center py-20 text-sm text-muted-foreground">
					No files changed in this pull request.
				</div>
			);
		}

		return (
			<div ref={diffPanelRef} className="h-full overflow-auto">
				<div className="flex flex-col gap-4 p-4">
					{visibleFiles.map((file) => (
						<ReviewFileDiffBlock
							key={file.filename}
							id={encodeFileId(file.filename)}
							file={file}
							diffStyle={diffStyle}
							isNearViewport={nearViewportFiles.has(file.filename)}
							annotations={
								annotationsByFile.get(file.filename) ?? EMPTY_ANNOTATIONS
							}
							repliesByCommentId={repliesByCommentId}
							owner={owner}
							repo={repo}
							pullNumber={pullNumber}
							pendingComments={
								pendingCommentsByFile.get(file.filename) ??
								EMPTY_PENDING_COMMENTS
							}
							activeCommentForm={
								activeCommentForm?.path === file.filename
									? activeCommentForm
									: null
							}
							selectedLines={
								activeCommentForm?.path === file.filename ? selectedLines : null
							}
							onGutterClick={onStartComment}
							onCancelComment={onCancelComment}
							onAddComment={onAddComment}
							onEditComment={onEditComment}
							mentionConfig={mentionConfig}
							viewerLogin={viewerLogin}
							threadInfoByCommentId={threadInfoByCommentId}
						/>
					))}

					{(visibleCount < files.length || hasNextPage) && (
						<>
							<div ref={loadMoreRef} className="h-8" />
							<div className="rounded-lg border bg-surface-0 px-3 py-2 text-xs text-muted-foreground">
								Loaded patch payload for {files.length} of {totalFileCount}{" "}
								files
								{isFetchingNextPage ? "..." : ""}
							</div>
						</>
					)}
				</div>
			</div>
		);
	}),
);

ReviewDiffPane.displayName = "ReviewDiffPane";
