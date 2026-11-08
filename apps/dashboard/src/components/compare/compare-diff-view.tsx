import { cn } from "@diffkit/ui/lib/utils";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	DiffCommitList,
	type DiffStyle,
	DiffToolbar,
	type DiffView,
} from "#/components/pulls/review/review-diff-toolbar";
import { ReviewFileDiffBlock } from "#/components/pulls/review/review-file-diff-block";
import type {
	PendingComment,
	ReviewAnnotation,
} from "#/components/pulls/review/review-types";
import { encodeFileId } from "#/components/pulls/review/review-utils";
import type {
	PullCommit,
	PullFile,
	PullReviewComment,
} from "#/lib/github.types";

const EMPTY_ANNOTATIONS: DiffLineAnnotation<PullReviewComment>[] = [];
const EMPTY_PENDING: PendingComment[] = [];
const EMPTY_REPLIES: ReadonlyMap<number, PullReviewComment[]> = new Map();
const EMPTY_THREAD_INFO: ReadonlyMap<
	number,
	{ threadId: string; isResolved: boolean }
> = new Map();

const INITIAL_VISIBLE_COUNT = 30;
const LOAD_MORE_CHUNK = 12;

const noop = () => {};
const noopRange = () => {};
const noopAnnotation = (
	_a: DiffLineAnnotation<ReviewAnnotation> | PendingComment,
) => {};
const noopEdit = (_a: PendingComment, _b: string) => {};

export function CompareDiffView({
	commits,
	files,
	filesTruncated = false,
	owner,
	repo,
}: {
	commits: PullCommit[];
	files: PullFile[];
	filesTruncated?: boolean;
	owner: string;
	repo: string;
}) {
	const [diffStyle, setDiffStyle] = useState<DiffStyle>("split");
	const [view, setView] = useState<DiffView>("files");
	const [wrapLines, setWrapLines] = useState(false);
	const [visibleCount, setVisibleCount] = useState(() =>
		Math.min(files.length, INITIAL_VISIBLE_COUNT),
	);
	const loadMoreRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setVisibleCount(
			Math.min(files.length, files.length === 0 ? 0 : INITIAL_VISIBLE_COUNT),
		);
	}, [files]);

	useEffect(() => {
		if (visibleCount >= files.length) return;
		const sentinel = loadMoreRef.current;
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				setVisibleCount((prev) =>
					Math.min(files.length, prev + LOAD_MORE_CHUNK),
				);
			},
			{ rootMargin: "3000px 0px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [files.length, visibleCount]);

	const visibleFiles = useMemo(
		() => files.slice(0, visibleCount),
		[files, visibleCount],
	);

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<DiffToolbar
				view={view}
				onViewChange={setView}
				fileCount={files.length}
				commitCount={commits.length}
				diffStyle={diffStyle}
				onDiffStyleChange={setDiffStyle}
				wrapLines={wrapLines}
				onWrapLinesChange={setWrapLines}
			/>
			{view === "commits" ? (
				<DiffCommitList commits={commits} owner={owner} repo={repo} />
			) : null}
			<div
				className={cn("flex flex-col gap-2", view === "commits" && "hidden")}
			>
				{filesTruncated ? (
					<p className="rounded-lg bg-pill-warning px-4 py-3 text-xs font-[450] text-pill-warning-text">
						This comparison includes more than {files.length} files; GitHub only
						returns the first {files.length}. Push fewer changes or open the PR
						to view the full set.
					</p>
				) : null}
				{files.length === 0 ? (
					<p className="px-4 py-10 text-center text-[13px] font-[450] text-muted-foreground">
						No files changed.
					</p>
				) : (
					<>
						{visibleFiles.map((file) => (
							<ReviewFileDiffBlock
								key={file.filename}
								id={encodeFileId(file.filename)}
								file={file}
								diffStyle={diffStyle}
								wrapLines={wrapLines}
								isNearViewport
								readOnly
								annotations={EMPTY_ANNOTATIONS}
								repliesByCommentId={EMPTY_REPLIES}
								owner={owner}
								repo={repo}
								pullNumber={0}
								pendingComments={EMPTY_PENDING}
								activeCommentForm={null}
								selectedLines={null}
								onGutterClick={noopRange}
								onCancelComment={noop}
								onAddComment={noopAnnotation}
								onEditComment={noopEdit}
								threadInfoByCommentId={EMPTY_THREAD_INFO}
							/>
						))}

						{visibleCount < files.length ? (
							<>
								<div ref={loadMoreRef} className="h-8" />
								<p className="rounded-lg border-[0.5px] border-card-border bg-surface-0 px-4 py-3 text-xs font-[450] text-muted-foreground">
									Showing {visibleCount} of {files.length} files
								</p>
							</>
						) : null}
					</>
				)}
			</div>
		</div>
	);
}
