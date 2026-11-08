import { FileIcon, GitCommitIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReviewFileDiffBlock } from "#/components/pulls/review/review-file-diff-block";
import type {
	PendingComment,
	ReviewAnnotation,
} from "#/components/pulls/review/review-types";
import { encodeFileId } from "#/components/pulls/review/review-utils";
import { formatRelativeTime } from "#/lib/format-relative-time";
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
	const [diffStyle, setDiffStyle] = useState<"unified" | "split">("split");
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

	const totals = useMemo(() => {
		let additions = 0;
		let deletions = 0;
		for (const f of files) {
			additions += f.additions;
			deletions += f.deletions;
		}
		return { additions, deletions };
	}, [files]);

	return (
		<div className="flex flex-col gap-16">
			<section className="flex flex-col gap-3">
				<h2 className="flex items-center gap-2 text-sm font-semibold">
					<GitCommitIcon size={15} strokeWidth={2} />
					Commits
					<span className="text-xs font-normal text-muted-foreground">
						({commits.length})
					</span>
				</h2>
				{commits.length === 0 ? (
					<p className="rounded-lg border bg-surface-0 px-4 py-3 text-sm text-muted-foreground">
						No new commits.
					</p>
				) : (
					<ol className="flex flex-col divide-y rounded-lg border bg-surface-0">
						{commits.map((commit) => {
							const firstLine = commit.message.split("\n")[0];
							return (
								<li
									key={commit.sha}
									className="flex items-center gap-3 px-4 py-2.5 text-sm"
								>
									<div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-1">
										<GitCommitIcon
											size={12}
											strokeWidth={2}
											className="text-muted-foreground"
										/>
									</div>
									{commit.author ? (
										<img
											src={commit.author.avatarUrl}
											alt={commit.author.login}
											className="size-5 shrink-0 rounded-full border border-border"
										/>
									) : (
										<div className="size-5 shrink-0 rounded-full bg-surface-2" />
									)}
									<Link
										to="/$owner/$repo/commit/$sha"
										params={{ owner, repo, sha: commit.sha }}
										className="min-w-0 flex-1 truncate text-left text-foreground transition-colors hover:text-foreground hover:underline"
									>
										{firstLine}
									</Link>
									<code className="shrink-0 rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
										{commit.sha.slice(0, 7)}
									</code>
									{commit.createdAt ? (
										<span className="shrink-0 text-xs text-muted-foreground">
											{formatRelativeTime(commit.createdAt)}
										</span>
									) : null}
								</li>
							);
						})}
					</ol>
				)}
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<h2 className="flex items-center gap-2 text-sm font-semibold">
						<FileIcon size={15} strokeWidth={2} />
						Files changed
						<span className="text-xs font-normal text-muted-foreground">
							({files.length})
						</span>
						{files.length > 0 ? (
							<span className="ml-2 flex items-center gap-1.5 text-xs">
								<span className="tabular-nums font-medium text-success">
									+{totals.additions}
								</span>
								<span className="tabular-nums font-medium text-danger">
									-{totals.deletions}
								</span>
							</span>
						) : null}
					</h2>
					{files.length > 0 ? (
						<div className="flex items-center rounded-md border bg-surface-1">
							<button
								type="button"
								className={cn(
									"rounded-l-md px-2.5 py-1 text-xs font-medium transition-colors",
									diffStyle === "unified"
										? "bg-surface-0 text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setDiffStyle("unified")}
							>
								Unified
							</button>
							<button
								type="button"
								className={cn(
									"rounded-r-md px-2.5 py-1 text-xs font-medium transition-colors",
									diffStyle === "split"
										? "bg-surface-0 text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
								onClick={() => setDiffStyle("split")}
							>
								Split
							</button>
						</div>
					) : null}
				</div>
				{filesTruncated ? (
					<p className="rounded-lg bg-pill-warning px-3 py-2.5 text-xs text-pill-warning-text">
						This comparison includes more than {files.length} files; GitHub only
						returns the first {files.length}. Push fewer changes or open the PR
						to view the full set.
					</p>
				) : null}
				{files.length === 0 ? (
					<p className="rounded-lg border bg-surface-0 px-4 py-3 text-sm text-muted-foreground">
						No files changed.
					</p>
				) : (
					<div className="flex flex-col gap-4">
						{visibleFiles.map((file) => (
							<ReviewFileDiffBlock
								key={file.filename}
								id={encodeFileId(file.filename)}
								file={file}
								diffStyle={diffStyle}
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
								<div className="rounded-lg border bg-surface-0 px-3 py-2 text-xs text-muted-foreground">
									Showing {visibleCount} of {files.length} files
								</div>
							</>
						) : null}
					</div>
				)}
			</section>
		</div>
	);
}
