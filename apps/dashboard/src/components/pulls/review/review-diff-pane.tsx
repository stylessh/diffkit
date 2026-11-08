import type { MentionConfig } from "@diffkit/ui/components/markdown-editor";
import { cn } from "@diffkit/ui/lib/utils";
import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import {
	forwardRef,
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useReducer,
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
	/** The bar above the file cards (Files / Commits, display options). */
	toolbar?: ReactNode;
	/** Shown in place of the file cards (e.g. the commit list); the cards stay mounted. */
	alternateView?: ReactNode;
	wrapLines?: boolean;
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
			toolbar,
			alternateView,
			wrapLines = false,
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

		// Near-viewport tracking lives in a ref so the observer is NOT torn
		// down on every scroll tick. State updates to a Set dep previously
		// recreated the observer, opening a race window where elements that
		// scrolled into view during teardown were never re-observed — the
		// "diffs sometimes don't render" bug.
		const nearViewportRef = useRef<Set<string>>(new Set());
		const [, bumpNearViewport] = useReducer((n: number) => n + 1, 0);
		const nearViewportObserverRef = useRef<IntersectionObserver | null>(null);
		const activeFileObserverRef = useRef<IntersectionObserver | null>(null);
		const onActiveFileChangeRef = useRef(onActiveFileChange);

		useEffect(() => {
			onActiveFileChangeRef.current = onActiveFileChange;
		}, [onActiveFileChange]);

		// Create both observers once, tied to the scroll panel's lifetime.
		useEffect(() => {
			const panel = diffPanelRef.current;
			if (!panel) return;

			const nearObserver = new IntersectionObserver(
				(entries) => {
					let changed = false;
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						const filename = entry.target.getAttribute("data-filename");
						if (filename && !nearViewportRef.current.has(filename)) {
							nearViewportRef.current.add(filename);
							nearObserver.unobserve(entry.target);
							changed = true;
						}
					}
					if (changed) bumpNearViewport();
				},
				{
					root: panel,
					rootMargin: "1500px 0px",
					threshold: 0,
				},
			);

			const activeObserver = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						const filename = entry.target.getAttribute("data-filename");
						if (filename) onActiveFileChangeRef.current(filename);
					}
				},
				{
					root: panel,
					rootMargin: "-10% 0px -80% 0px",
					threshold: 0,
				},
			);

			nearViewportObserverRef.current = nearObserver;
			activeFileObserverRef.current = activeObserver;

			return () => {
				nearObserver.disconnect();
				activeObserver.disconnect();
				nearViewportObserverRef.current = null;
				activeFileObserverRef.current = null;
			};
		}, []);

		// Seed the first visible files as near-viewport immediately.
		// During client-side navigation the scroll container may not have its
		// final dimensions when the IntersectionObserver first checks, causing
		// all diffs to remain as empty placeholders until a hard refresh.
		useEffect(() => {
			if (visibleFiles.length === 0 || nearViewportRef.current.size > 0) {
				return;
			}
			for (const file of visibleFiles.slice(0, 4)) {
				nearViewportRef.current.add(file.filename);
			}
			bumpNearViewport();
		}, [visibleFiles]);

		// Observe any newly-mounted file elements. observe() is idempotent, so
		// re-calling it on already-observed nodes is safe.
		useEffect(() => {
			const nearObserver = nearViewportObserverRef.current;
			const activeObserver = activeFileObserverRef.current;
			if (!nearObserver || !activeObserver) return;

			for (const file of visibleFiles) {
				const element = document.getElementById(encodeFileId(file.filename));
				if (!element) continue;
				activeObserver.observe(element);
				if (!nearViewportRef.current.has(file.filename)) {
					nearObserver.observe(element);
				}
			}
		}, [visibleFiles]);

		const isEmpty = totalFileCount === 0 && !hasNextPage;

		return (
			<div ref={diffPanelRef} className="h-full overflow-auto">
				<div className="flex min-w-0 flex-col gap-2 px-[14px] pb-6 max-md:px-2">
					{toolbar}
					{alternateView}
					{isEmpty && !alternateView ? (
						<p className="px-4 py-10 text-center text-[13px] font-[450] text-muted-foreground">
							No files changed in this pull request.
						</p>
					) : null}
					<div className={cn("flex flex-col gap-2", alternateView && "hidden")}>
						{visibleFiles.map((file) => (
							<ReviewFileDiffBlock
								key={file.filename}
								id={encodeFileId(file.filename)}
								file={file}
								diffStyle={diffStyle}
								wrapLines={wrapLines}
								isNearViewport={nearViewportRef.current.has(file.filename)}
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
									activeCommentForm?.path === file.filename
										? selectedLines
										: null
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
								<p className="rounded-lg border-[0.5px] border-card-border bg-surface-0 px-4 py-3 text-xs font-[450] text-muted-foreground">
									Loaded patch payload for {files.length} of {totalFileCount}{" "}
									files
									{isFetchingNextPage ? "…" : ""}
								</p>
							</>
						)}
					</div>
				</div>
			</div>
		);
	}),
);

ReviewDiffPane.displayName = "ReviewDiffPane";
