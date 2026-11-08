import {
	CommentIcon,
	Delete01Icon,
	ExternalLinkIcon,
	FileIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	RefreshCwIcon,
} from "@diffkit/icons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@diffkit/ui/components/alert-dialog";
import { Button } from "@diffkit/ui/components/button";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ReviewSubmitPopover } from "#/components/pulls/review/review-submit-popover";
import { encodeFileId } from "#/components/pulls/review/review-utils";
import { formatRelativeTime } from "#/lib/format-relative-time";
import { githubReviewDraftsQueryOptions } from "#/lib/github.query";
import type { ReviewDraftComment, ReviewDraftPull } from "#/lib/github.types";
import {
	formatReviewDraftLocation,
	reviewDraftBodyPreview,
} from "#/lib/review-drafts";
import { useHasMounted } from "#/lib/use-has-mounted";
import {
	type ReviewDraftBusyState,
	useReviewDraftActions,
} from "./use-review-draft-actions";

export function ReviewDraftsPage({ userId }: { userId: string }) {
	const scope = useMemo(() => ({ userId }), [userId]);
	const hasMounted = useHasMounted();
	const query = useQuery({
		...githubReviewDraftsQueryOptions(scope),
		enabled: hasMounted,
	});
	const { busy, submit, discard } = useReviewDraftActions(scope);
	const [draftToDelete, setDraftToDelete] = useState<ReviewDraftPull | null>(
		null,
	);

	if (query.error && !query.data) throw query.error;

	const result = query.data;
	const drafts = result?.drafts ?? [];
	const commentTotal = drafts.reduce(
		(sum, draft) => sum + draft.review.commentCount,
		0,
	);

	return (
		<div className="h-full overflow-auto py-10">
			<div className="mx-auto grid max-w-7xl gap-14 px-3 md:px-6 xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
				<aside className="flex h-fit flex-col gap-5 xl:sticky xl:top-0">
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">Drafts</h1>
						<p className="text-sm text-muted-foreground">
							{result ? (
								<>
									<span className="tabular-nums">{drafts.length}</span> pending{" "}
									{drafts.length === 1 ? "review" : "reviews"} ·{" "}
									<span className="tabular-nums">{commentTotal}</span>{" "}
									{commentTotal === 1 ? "comment" : "comments"}
								</>
							) : (
								"Looking for unsubmitted reviews…"
							)}
						</p>
					</div>

					<div className="flex items-center justify-between gap-4 rounded-xl bg-surface-1 px-3.5 py-3">
						<div className="flex min-w-0 items-center gap-2">
							<div className="shrink-0 text-muted-foreground">
								<GitPullRequestDraftIcon size={15} strokeWidth={1.9} />
							</div>
							<p className="truncate text-sm font-medium">Pending reviews</p>
						</div>
						<p className="font-semibold tabular-nums leading-tight">
							{result ? drafts.length : "–"}
						</p>
					</div>

					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="w-fit text-muted-foreground"
						disabled={query.isFetching}
						onClick={() => void query.refetch()}
						iconLeft={
							query.isFetching ? (
								<Spinner size={13} />
							) : (
								<RefreshCwIcon size={14} strokeWidth={2} />
							)
						}
					>
						Refresh
					</Button>

					{result ? (
						<div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
							<p>
								Checked{" "}
								<span className="tabular-nums">{result.checkedCount}</span> open
								pull requests you're involved in.
							</p>
							{result.truncated ? (
								<p>
									Only your most relevant pull requests are checked; older
									drafts may not appear here.
								</p>
							) : null}
							{result.partial ? (
								<p>
									Some repositories couldn't be checked, so this list may be
									incomplete.
								</p>
							) : null}
						</div>
					) : null}
				</aside>

				<div className="flex min-w-0 flex-col gap-4">
					{!result ? (
						<ReviewDraftsSkeleton />
					) : drafts.length === 0 ? (
						<ReviewDraftsEmptyState />
					) : (
						drafts.map((draft) => (
							<ReviewDraftGroup
								key={draft.review.reviewId}
								draft={draft}
								busy={busy.get(draft.review.reviewId)}
								onSubmit={(body, event) => submit(draft, event, body)}
								onDelete={() => setDraftToDelete(draft)}
							/>
						))
					)}
				</div>
			</div>

			<AlertDialog
				open={draftToDelete !== null}
				onOpenChange={(open) => {
					if (!open) setDraftToDelete(null);
				}}
			>
				<AlertDialogContent className="p-6">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete pending review?</AlertDialogTitle>
						<AlertDialogDescription>
							{draftToDelete
								? `${draftToDelete.review.commentCount} pending ${
										draftToDelete.review.commentCount === 1
											? "comment"
											: "comments"
									} on ${draftToDelete.repositoryFullName} #${draftToDelete.number} will be permanently deleted from GitHub.`
								: null}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-white hover:bg-destructive/90"
							onClick={() => {
								if (draftToDelete) void discard(draftToDelete);
								setDraftToDelete(null);
							}}
						>
							Delete review
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function ReviewDraftGroup({
	draft,
	busy,
	onSubmit,
	onDelete,
}: {
	draft: ReviewDraftPull;
	busy: ReviewDraftBusyState | undefined;
	onSubmit: (
		body: string,
		event: "APPROVE" | "COMMENT" | "REQUEST_CHANGES",
	) => Promise<boolean>;
	onDelete: () => void;
}) {
	const { review } = draft;
	const pullId = String(draft.number);
	const hiddenComments = review.commentCount - review.comments.length;
	const fileCount = new Set(review.comments.map((comment) => comment.path))
		.size;
	const StateIcon = draft.isDraft
		? GitPullRequestDraftIcon
		: GitPullRequestIcon;

	return (
		<section
			aria-label={`Pending review on ${draft.repositoryFullName} #${draft.number}`}
			className="overflow-hidden rounded-xl border bg-surface-0"
		>
			<header className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b px-4 py-3">
				<div
					className={
						draft.isDraft
							? "mt-[3px] shrink-0 text-muted-foreground"
							: "mt-[3px] shrink-0 text-green-500"
					}
				>
					<StateIcon size={16} strokeWidth={2} />
				</div>
				<div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
					<Link
						to="/$owner/$repo/pull/$pullId"
						params={{ owner: draft.owner, repo: draft.repo, pullId }}
						preload={false}
						className="text-sm font-medium hover:underline md:truncate"
					>
						{draft.title}
					</Link>
					<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
						<span>
							{draft.repositoryFullName} #{draft.number}
						</span>
						<span>·</span>
						<span className="flex items-center gap-1 tabular-nums">
							<CommentIcon size={12} strokeWidth={2} />
							{review.commentCount}
						</span>
						{fileCount > 0 ? (
							<span className="flex items-center gap-1 tabular-nums">
								<FileIcon size={12} strokeWidth={2} />
								{fileCount}
							</span>
						) : null}
						<span>·</span>
						<span>Edited {formatRelativeTime(review.updatedAt)}</span>
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
					<Button variant="ghost" size="xs" asChild>
						<Link
							to="/$owner/$repo/review/$pullId"
							params={{ owner: draft.owner, repo: draft.repo, pullId }}
							preload={false}
						>
							Open review
						</Link>
					</Button>
					<ReviewSubmitPopover
						pendingCount={review.commentCount}
						isSubmitting={busy === "submit"}
						onSubmit={onSubmit}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground hover:text-destructive"
						aria-label={`Delete pending review on ${draft.repositoryFullName} #${draft.number}`}
						disabled={busy !== undefined}
						onClick={onDelete}
					>
						{busy === "delete" ? (
							<Spinner size={13} />
						) : (
							<Delete01Icon size={14} strokeWidth={1.9} />
						)}
					</Button>
				</div>
			</header>

			{review.body.trim() ? (
				<p className="line-clamp-2 border-b bg-surface-1 px-4 py-2 text-xs text-muted-foreground">
					<span className="font-medium text-foreground">Review summary: </span>
					{reviewDraftBodyPreview(review.body, 240)}
				</p>
			) : null}

			{review.comments.length > 0 ? (
				<ul className="divide-y">
					{review.comments.map((comment) => (
						<li key={comment.id}>
							<DraftCommentRow draft={draft} comment={comment} />
						</li>
					))}
				</ul>
			) : (
				<p className="px-4 py-3 text-xs text-muted-foreground">
					This review has a summary but no line comments yet.
				</p>
			)}

			{hiddenComments > 0 ? (
				<div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
					<span>
						+<span className="tabular-nums">{hiddenComments}</span> more{" "}
						{hiddenComments === 1 ? "comment" : "comments"}
					</span>
					<a
						href={review.url}
						target="_blank"
						rel="noreferrer"
						className="flex items-center gap-1 hover:text-foreground"
					>
						View on GitHub
						<ExternalLinkIcon size={12} strokeWidth={2} />
					</a>
				</div>
			) : null}
		</section>
	);
}

function DraftCommentRow({
	draft,
	comment,
}: {
	draft: ReviewDraftPull;
	comment: ReviewDraftComment;
}) {
	const location = formatReviewDraftLocation(comment);
	return (
		<Link
			to="/$owner/$repo/review/$pullId"
			params={{
				owner: draft.owner,
				repo: draft.repo,
				pullId: String(draft.number),
			}}
			hash={encodeFileId(comment.path)}
			preload={false}
			className="flex flex-col gap-1 px-4 py-2.5 transition-colors hover:bg-surface-1"
		>
			<span className="flex min-w-0 items-center gap-2 text-xs">
				<span className="min-w-0 truncate font-mono text-foreground">
					{comment.path}
				</span>
				<span className="shrink-0 rounded-md border bg-surface-1 px-1.5 py-px font-mono text-[11px] tabular-nums text-muted-foreground">
					{location}
				</span>
				{comment.outdated && location !== "Outdated" ? (
					<span className="shrink-0 text-[11px] text-amber-500">Outdated</span>
				) : null}
			</span>
			<span className="line-clamp-2 text-xs text-muted-foreground">
				{reviewDraftBodyPreview(comment.body, 240)}
			</span>
		</Link>
	);
}

function ReviewDraftsSkeleton() {
	return (
		<>
			{[0, 1].map((key) => (
				<div key={key} className="overflow-hidden rounded-xl border">
					<div className="flex items-start gap-3 border-b px-4 py-3">
						<Skeleton className="mt-1 size-4 rounded-full" />
						<div className="flex flex-1 flex-col gap-2">
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-3 w-1/3" />
						</div>
						<Skeleton className="h-7 w-28 rounded-lg" />
					</div>
					{[0, 1].map((row) => (
						<div key={row} className="flex flex-col gap-2 px-4 py-3">
							<Skeleton className="h-3 w-1/2" />
							<Skeleton className="h-3 w-5/6" />
						</div>
					))}
				</div>
			))}
		</>
	);
}

function ReviewDraftsEmptyState() {
	return (
		<div className="flex flex-col items-center gap-3 px-4 py-16 text-center sm:px-6">
			<div className="flex size-12 items-center justify-center rounded-full bg-surface-1 text-muted-foreground">
				<GitPullRequestDraftIcon size={22} strokeWidth={1.7} />
			</div>
			<div className="flex flex-col gap-1.5">
				<p className="text-sm font-medium text-foreground">
					No pending reviews
				</p>
				<p className="max-w-sm text-xs text-muted-foreground">
					Review comments you've started on GitHub but haven't submitted show up
					here, grouped by pull request.
				</p>
			</div>
		</div>
	);
}
