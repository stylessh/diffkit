import {
	AlertCircleIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	CircleIcon,
	CommentIcon,
	Delete01Icon,
	EditIcon,
	GitBranchIcon,
	GitCommitIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestIcon,
	IssueClosedCompletedIcon,
	IssueClosedNotPlannedIcon,
	MoreHorizontalIcon,
	RefreshCwIcon,
	ReviewsIcon,
	UserAddIcon,
	XIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Checkbox } from "@diffkit/ui/components/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@diffkit/ui/components/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { MarkdownEditor } from "@diffkit/ui/components/markdown-editor";
import { MenuCheck } from "@diffkit/ui/components/menu";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { StatePill } from "@diffkit/ui/components/state-pill";
import { quickhubDark, quickhubLight } from "@diffkit/ui/lib/diffs-themes";
import { cn } from "@diffkit/ui/lib/utils";
import type { DiffLineAnnotation, PatchDiffProps } from "@pierre/diffs/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import {
	type ComponentType,
	type LazyExoticComponent,
	lazy,
	Suspense,
	useCallback,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import {
	CommentBody,
	EditedMark,
	useCommentEditor,
} from "#/components/details/comment-body";
import { CommentMoreMenu } from "#/components/details/comment-more-menu";
import { IssueCommentReactionBar } from "#/components/details/comment-reaction-bar";
import { CommentReplyForm } from "#/components/details/comment-reply-form";
import { buildCommentThreads } from "#/components/details/comment-threads";
import {
	DetailActivityHeader,
	DetailCommentBox,
} from "#/components/details/detail-activity";
import {
	GroupedIssueStateToggleDescription,
	GroupedLabelDescription,
	GroupedReviewRequestDescription,
	groupTimelineEvents,
} from "#/components/details/grouped-label-event";
import { LabelPill } from "#/components/details/label-pill";
import { AppMarkdown } from "#/components/markdown/app-markdown";
import { useMergeBypass } from "#/components/pulls/detail/use-merge-bypass";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	approveWorkflowRuns,
	deleteBranch,
	dismissPullReview,
	getCommentPage,
	getTimelineEventPage,
	markPullReadyForReview,
	mergePullRequest,
	replyToReviewComment,
	requestPullReviewers,
	rerunChecks,
	resolveReviewThread,
	unresolveReviewThread,
	updatePullBranch,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubPullStatusQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import type {
	CommentPagination,
	EventPagination,
	GitHubActor,
	GroupedIssueStateToggleEvent,
	GroupedLabelEvent,
	GroupedReviewRequestEvent,
	PullCheckRun,
	PullComment,
	PullCommit,
	PullDetail,
	PullPageData,
	PullReviewComment,
	PullStatus,
	PullWorkflowApproval,
	TimelineEvent,
} from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	pullEntityKey,
	removePullFromOpenViews,
	repoEntityKey,
} from "#/lib/github-query-updates";
import {
	mergeIssueStateIntoCloseEvent,
	parseCloseReason,
} from "#/lib/timeline-close-reason";
import { usePrefersNoHover } from "#/lib/use-prefers-no-hover";
import { checkPermissionWarning } from "#/lib/warning-store";

// Lazy-load PatchDiff for review comment diff hunks
type ActivityPatchDiffProps = PatchDiffProps<PullReviewComment>;

const PatchDiff: LazyExoticComponent<ComponentType<ActivityPatchDiffProps>> =
	lazy(() =>
		import.meta.env.SSR
			? Promise.resolve({
					default: (() => null) as ComponentType<ActivityPatchDiffProps>,
				})
			: import("@pierre/diffs/react").then((mod) => ({
					default: mod.PatchDiff as ComponentType<ActivityPatchDiffProps>,
				})),
	);

let themesRegistered = false;
if (!import.meta.env.SSR && !themesRegistered) {
	themesRegistered = true;
	import("@pierre/diffs").then(({ registerCustomTheme }) => {
		registerCustomTheme("quickhub-light", () => Promise.resolve(quickhubLight));
		registerCustomTheme("quickhub-dark", () => Promise.resolve(quickhubDark));
	});
}

export function PullDetailActivitySection({
	comments,
	commits,
	events,
	reviewComments,
	commentPagination,
	eventPagination,
	pageQueryKey,
	isFetching,
	pr,
	owner,
	repo,
	pullNumber,
	scope,
	headRefDeleted,
	viewerLogin,
	threadInfoByCommentId,
}: {
	comments?: PullComment[];
	commits?: PullCommit[];
	events?: TimelineEvent[];
	reviewComments?: PullReviewComment[];
	commentPagination?: CommentPagination;
	eventPagination?: EventPagination;
	pageQueryKey: readonly unknown[];
	isFetching: boolean;
	pr: PullDetail;
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
	headRefDeleted: boolean;
	viewerLogin?: string;
	threadInfoByCommentId?: ReadonlyMap<
		number,
		{ threadId: string; isResolved: boolean }
	>;
}) {
	return (
		<div className="flex flex-col">
			<DetailActivityHeader
				title="Activity"
				count={
					comments && commits
						? comments.length + commits.length + (events?.length ?? 0)
						: undefined
				}
			/>

			{isFetching && !comments && (
				<div className="flex items-center justify-center py-8">
					<svg
						className="size-4 animate-spin text-muted-foreground"
						viewBox="0 0 16 16"
						fill="none"
						aria-hidden="true"
					>
						<circle
							cx="8"
							cy="8"
							r="6.5"
							stroke="currentColor"
							strokeWidth="2"
							opacity="0.25"
						/>
						<path
							d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
				</div>
			)}

			{comments &&
				commits &&
				comments.length === 0 &&
				commits.length === 0 &&
				(!events || events.length === 0) && (
					<p className="py-4 text-sm text-muted-foreground">No activity yet.</p>
				)}

			<ActivityTimeline
				comments={comments ?? []}
				commits={commits ?? []}
				events={events ?? []}
				reviewComments={reviewComments ?? []}
				pr={pr}
				commentPagination={commentPagination}
				eventPagination={eventPagination}
				pageQueryKey={pageQueryKey}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
				scope={scope}
				viewerLogin={viewerLogin}
				threadInfoByCommentId={threadInfoByCommentId}
			/>

			{!pr.isMerged && pr.state !== "closed" && (
				<div className="mt-6">
					<MergeStatusSection
						scope={scope}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						prTitle={pr.title}
						firstCommitMessage={commits?.[0]?.message}
						isDraft={pr.isDraft}
						pullId={pr.graphqlId}
					/>
				</div>
			)}

			{pr.isMerged && (
				<div className="mt-6">
					<MergedBranchBanner
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						branchName={pr.headRefName}
						headRefDeleted={headRefDeleted}
					/>
				</div>
			)}

			<div className="mt-6">
				<DetailCommentBox
					owner={owner}
					repo={repo}
					issueNumber={pullNumber}
					scope={scope}
					involvedUsers={getInvolvedUsers(pr, comments)}
					stateToggle={
						!pr.isMerged && (pr.state === "open" || pr.state === "closed")
							? { kind: "pull", state: pr.state }
							: undefined
					}
				/>
			</div>
		</div>
	);
}

function getInvolvedUsers(
	pr: PullDetail,
	comments?: PullComment[],
): GitHubActor[] {
	const seen = new Set<string>();
	const users: GitHubActor[] = [];

	const add = (actor: GitHubActor | null | undefined) => {
		if (!actor || seen.has(actor.login)) return;
		seen.add(actor.login);
		users.push(actor);
	};

	// PR author first
	add(pr.author);

	// Requested reviewers
	for (const reviewer of pr.requestedReviewers) {
		add(reviewer);
	}

	// Commenters (most recent first to prioritize active participants)
	if (comments) {
		for (let i = comments.length - 1; i >= 0; i--) {
			add(comments[i].author);
		}
	}

	return users;
}

// ── Merge status section ─────────────────────────────────────────────

function MergeStatusSection({
	scope,
	owner,
	repo,
	pullNumber,
	prTitle,
	firstCommitMessage,
	isDraft,
	pullId,
}: {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	pullNumber: number;
	prTitle: string;
	firstCommitMessage?: string;
	isDraft: boolean;
	pullId: string | undefined;
}) {
	const input = useMemo(
		() => ({ owner, repo, pullNumber }),
		[owner, repo, pullNumber],
	);
	const statusQuery = useQuery({
		...githubPullStatusQueryOptions(scope, input),
	});

	const status = statusQuery.data ?? null;

	if (!status) return <MergeStatusSkeleton />;

	return (
		<MergeStatusCard
			scope={scope}
			status={status}
			owner={owner}
			repo={repo}
			pullNumber={pullNumber}
			prTitle={prTitle}
			firstCommitMessage={firstCommitMessage}
			isDraft={isDraft}
			pullId={pullId}
		/>
	);
}

function MergedBranchBanner({
	owner,
	repo,
	pullNumber,
	branchName,
	headRefDeleted,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	branchName: string;
	headRefDeleted: boolean;
}) {
	const [branchStatus, setBranchStatus] = useState<
		"present" | "deleting" | "deleted"
	>("present");
	const isDeleting = branchStatus === "deleting";

	const deleted = headRefDeleted || branchStatus === "deleted";

	const handleDelete = async () => {
		setBranchStatus("deleting");
		try {
			const result = await deleteBranch({
				data: { owner, repo, branch: branchName, pullNumber },
			});
			if (result.ok) {
				setBranchStatus("deleted");
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
				setBranchStatus("present");
			}
		} catch {
			toast.error("Failed to delete branch");
			setBranchStatus("present");
		}
	};

	return (
		<div className="flex items-center gap-3 rounded-lg bg-pill-merged px-4 py-3">
			<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-merged text-white">
				<GitMergeIcon size={12} strokeWidth={2} />
			</div>
			<p className="flex-1 text-[13px] text-pill-merged-text">
				{deleted ? (
					<>
						Branch{" "}
						<code className="rounded bg-pill-merged px-1 py-0.5 font-mono text-xs">
							{branchName}
						</code>{" "}
						has been deleted.
					</>
				) : (
					<>
						Branch{" "}
						<code className="rounded bg-pill-merged px-1 py-0.5 font-mono text-xs">
							{branchName}
						</code>{" "}
						has been merged.
					</>
				)}
			</p>
			{!deleted && (
				<Button
					variant="ghost"
					size="xs"
					disabled={isDeleting}
					className="shrink-0 text-pill-merged-text hover:bg-pill-merged"
					iconLeft={
						isDeleting ? (
							<Spinner size={12} />
						) : (
							<Delete01Icon size={12} strokeWidth={2} />
						)
					}
					onClick={() => {
						void handleDelete();
					}}
				>
					Delete branch
				</Button>
			)}
		</div>
	);
}

function MergeStatusCard({
	scope,
	status,
	owner,
	repo,
	pullNumber,
	prTitle,
	firstCommitMessage,
	isDraft,
	pullId,
}: {
	scope: GitHubQueryScope;
	status: PullStatus;
	owner: string;
	repo: string;
	pullNumber: number;
	prTitle: string;
	firstCommitMessage?: string;
	isDraft: boolean;
	pullId: string | undefined;
}) {
	const {
		checks,
		checkRuns,
		pendingWorkflowApprovals,
		reviews,
		mergeable,
		mergeableState,
		conflictingFiles = [],
		behindBy,
		baseRefName,
		canUpdateBranch,
		canBypassProtections,
		canMerge,
	} = status;

	const approvedReviews = reviews.filter((r) => r.state === "APPROVED");
	const changesRequested = reviews.filter(
		(r) => r.state === "CHANGES_REQUESTED",
	);

	const hasReviewIssue = changesRequested.length > 0;
	const allChecksPassed =
		checks.total > 0 &&
		checks.failed === 0 &&
		checks.pending === 0 &&
		checks.expected === 0;
	const hasCheckFailures = checks.failed > 0;
	const isBehind = behindBy !== null && behindBy > 0;
	const hasConflicts = mergeableState === "dirty";
	const isMergeBlocked = mergeableState === "blocked" || mergeable === false;

	const bypass = useMergeBypass({
		isMergeBlocked,
		canBypassProtections,
		hasConflicts,
	});

	return (
		<div className="-mx-3 flex flex-col overflow-hidden rounded-lg bg-card shadow-card">
			{/* Reviews section */}
			<ReviewsSection
				approvedReviews={approvedReviews}
				changesRequested={changesRequested}
				hasReviewIssue={hasReviewIssue}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
			/>

			{/* Checks section */}
			{(checks.total > 0 || pendingWorkflowApprovals.length > 0) && (
				<ChecksSection
					scope={scope}
					checks={checks}
					checkRuns={checkRuns}
					pendingWorkflowApprovals={pendingWorkflowApprovals}
					allChecksPassed={allChecksPassed}
					hasCheckFailures={hasCheckFailures}
					owner={owner}
					repo={repo}
					pullNumber={pullNumber}
				/>
			)}

			{/* Conflicts / branch status */}
			{hasConflicts ? (
				<ConflictsSection conflictingFiles={conflictingFiles} />
			) : isBehind ? (
				<StatusRow
					icon={<StatusIcon status="pending" />}
					title="This branch is out-of-date with the base branch"
					description={`Merge the latest changes from ${baseRefName} into this branch.`}
					action={
						canUpdateBranch ? (
							<UpdateBranchButton
								owner={owner}
								repo={repo}
								pullNumber={pullNumber}
							/>
						) : undefined
					}
				/>
			) : (
				<StatusRow
					icon={<StatusIcon status="success" />}
					title="No conflicts with base branch"
					description="Merging can be performed automatically."
				/>
			)}

			{/* Merge action footer (or "ready for review" CTA when draft) */}
			{isDraft ? (
				<ReadyForReviewFooter
					owner={owner}
					repo={repo}
					pullNumber={pullNumber}
					pullId={pullId}
				/>
			) : (
				<MergeFooter
					scope={scope}
					isMergeBlocked={isMergeBlocked}
					canMerge={canMerge}
					bypass={bypass}
					owner={owner}
					repo={repo}
					pullNumber={pullNumber}
					prTitle={prTitle}
					firstCommitMessage={firstCommitMessage}
				/>
			)}
		</div>
	);
}

// ── Reviews section ─────────────────────────────────────────────────

function ReviewsSection({
	approvedReviews,
	changesRequested,
	hasReviewIssue,
	owner,
	repo,
	pullNumber,
}: {
	approvedReviews: {
		id: number;
		state: string;
		author: { login: string; avatarUrl: string } | null;
	}[];
	changesRequested: {
		id: number;
		state: string;
		author: { login: string; avatarUrl: string } | null;
	}[];
	hasReviewIssue: boolean;
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const [open, setOpen] = useState(true);
	const queryClient = useQueryClient();

	const reviewStatus: StatusType = hasReviewIssue
		? "error"
		: approvedReviews.length > 0
			? "success"
			: "pending";

	const title = hasReviewIssue
		? "Changes requested"
		: approvedReviews.length > 0
			? "Changes approved"
			: "Review required";

	const description = hasReviewIssue
		? `${changesRequested.map((r) => r.author?.login).join(", ")} requested changes`
		: approvedReviews.length > 0
			? `${approvedReviews.length} approving review${approvedReviews.length > 1 ? "s" : ""} by reviewers with write access.`
			: "Code owner review required by reviewers with write access.";

	const allReviews = [...approvedReviews, ...changesRequested];

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3 text-left transition-colors hover:bg-item-hover"
				>
					<div className="mt-0.5 shrink-0">
						<StatusIcon status={reviewStatus} />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="text-[13px] font-medium text-foreground">{title}</p>
						<p className="text-xs text-muted-foreground">{description}</p>
					</div>
					<div className="mt-0.5 shrink-0 text-muted-foreground">
						<ChevronRightIcon
							size={14}
							strokeWidth={2}
							className={cn(
								"transition-transform duration-150",
								open && "rotate-90",
							)}
						/>
					</div>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				{allReviews.length === 0 && (
					<div className="border-b-[0.5px] border-card-border px-4 py-3 pl-11">
						<p className="text-xs text-muted-foreground">No reviewers added</p>
					</div>
				)}
				{allReviews.length > 0 && (
					<div className="flex flex-col border-b-[0.5px] border-card-border py-1">
						{allReviews.map((review) => (
							<div
								key={review.id}
								className="flex items-center gap-2 px-4 py-1.5 pl-11"
							>
								<CheckStateIcon
									state={review.state === "APPROVED" ? "success" : "failure"}
								/>
								{review.author && (
									<img
										src={review.author.avatarUrl}
										alt={review.author.login}
										className="size-4 rounded-full ring-[0.5px] ring-chip-border"
									/>
								)}
								<span className="text-xs">
									{review.author?.login ?? "Unknown"}
								</span>
								<span
									className={cn(
										"ml-auto text-xs",
										review.state === "APPROVED"
											? "text-success"
											: "text-danger",
									)}
								>
									{review.state === "APPROVED"
										? "Approved"
										: "Changes requested"}
								</span>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
										>
											<MoreHorizontalIcon size={14} strokeWidth={2} />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={() => {
												void dismissPullReview({
													data: {
														owner,
														repo,
														pullNumber,
														reviewId: review.id,
														message: "Dismissed via DiffKit",
													},
												})
													.then((result) => {
														if (result.ok) {
															void invalidateGitHubEntities(queryClient, null, [
																pullEntityKey({ owner, repo, pullNumber }),
															]);
														} else {
															toast.error(result.error);
															checkPermissionWarning(
																result,
																`${owner}/${repo}`,
															);
														}
													})
													.catch(() => {
														toast.error("Failed to dismiss review");
													});
											}}
										>
											Dismiss review
										</DropdownMenuItem>
										{review.author && (
											<DropdownMenuItem
												onClick={() => {
													void requestPullReviewers({
														data: {
															owner,
															repo,
															pullNumber,
															reviewers: [review.author?.login ?? ""],
														},
													})
														.then((result) => {
															if (result.ok) {
																void invalidateGitHubEntities(
																	queryClient,
																	null,
																	[pullEntityKey({ owner, repo, pullNumber })],
																);
															} else {
																toast.error(result.error);
																checkPermissionWarning(
																	result,
																	`${owner}/${repo}`,
																);
															}
														})
														.catch(() => {
															toast.error("Failed to re-request review");
														});
												}}
											>
												Re-request review
											</DropdownMenuItem>
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						))}
					</div>
				)}
			</CollapsibleContent>
		</Collapsible>
	);
}

// ── Checks section ──────────────────────────────────────────────────

function ChecksSection({
	scope,
	checks,
	checkRuns,
	pendingWorkflowApprovals,
	allChecksPassed,
	hasCheckFailures,
	owner,
	repo,
	pullNumber,
}: {
	scope: GitHubQueryScope;
	checks: PullStatus["checks"];
	checkRuns: PullCheckRun[];
	pendingWorkflowApprovals: PullWorkflowApproval[];
	allChecksPassed: boolean;
	hasCheckFailures: boolean;
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const [open, setOpen] = useState(true);
	const [pendingAction, setPendingAction] = useState<
		"rerun" | "approve" | null
	>(null);
	const isRerunning = pendingAction === "rerun";
	const isApproving = pendingAction === "approve";
	const queryClient = useQueryClient();
	const statusQueryKey = useMemo(
		() => githubQueryKeys.pulls.status(scope, { owner, repo, pullNumber }),
		[scope, owner, repo, pullNumber],
	);

	const pendingTotal = checks.pending + checks.expected;
	const approvalCount = pendingWorkflowApprovals.length;
	const isApprovalOnly = checks.total === 0 && approvalCount > 0;

	const checkStatus: StatusType = allChecksPassed
		? "success"
		: hasCheckFailures
			? "error"
			: "pending";

	const title = isApprovalOnly
		? `${approvalCount} workflow${approvalCount !== 1 ? "s" : ""} awaiting approval`
		: allChecksPassed
			? "All checks have passed"
			: hasCheckFailures
				? `${checks.failed} failing check${checks.failed > 1 ? "s" : ""}`
				: `${pendingTotal} pending check${pendingTotal > 1 ? "s" : ""}`;

	let description: string;
	if (isApprovalOnly) {
		description = "Approve to run workflows and report checks.";
	} else {
		const parts: string[] = [];
		if (checks.skipped > 0) parts.push(`${checks.skipped} skipped`);
		parts.push(
			`${checks.passed} successful check${checks.passed !== 1 ? "s" : ""}`,
		);
		if (checks.pending > 0) parts.push(`${checks.pending} pending`);
		if (checks.expected > 0) parts.push(`${checks.expected} expected`);
		if (checks.failed > 0) parts.push(`${checks.failed} failing`);
		description = parts.join(", ");
	}

	// Group by status in display order: expected, failed, pending, skipped, passed
	const groupedRuns = useMemo(() => {
		const groups: Record<
			"expected" | "failure" | "pending" | "waiting" | "skipped" | "success",
			PullCheckRun[]
		> = {
			expected: [],
			failure: [],
			pending: [],
			waiting: [],
			skipped: [],
			success: [],
		};
		for (const run of checkRuns) {
			groups[getCheckState(run)].push(run);
		}
		return groups;
	}, [checkRuns]);

	const checkRunGroups: Array<{
		key: keyof typeof groupedRuns;
		label: string;
	}> = [
		{ key: "expected", label: "Expected" },
		{ key: "failure", label: "Failed" },
		{ key: "pending", label: "Pending" },
		{ key: "waiting", label: "Waiting" },
		{ key: "skipped", label: "Skipped" },
		{ key: "success", label: "Passed" },
	];

	const handleRerun = async (failedOnly: boolean) => {
		setPendingAction("rerun");
		try {
			const result = await rerunChecks({
				data: { owner, repo, pullNumber, failedOnly },
			});
			if (result.ok) {
				const { rerun, skipped, failed } = result;
				if (failed > 0) {
					toast.warning(
						`Re-running ${rerun} check${rerun !== 1 ? "s" : ""}, but ${failed} failed`,
					);
				} else if (rerun > 0 && skipped > 0) {
					toast.success(
						`Re-running ${rerun} check${rerun !== 1 ? "s" : ""} · ${skipped} not eligible`,
					);
				} else if (rerun > 0) {
					toast.success(`Re-running ${rerun} check${rerun !== 1 ? "s" : ""}`);
				} else if (skipped > 0) {
					toast.info("No checks are eligible for rerun");
				}
				await invalidateGitHubEntities(queryClient, scope, [
					pullEntityKey({ owner, repo, pullNumber }),
				]);
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			toast.error("Failed to rerun checks");
		} finally {
			setPendingAction(null);
		}
	};

	const handleApprove = async () => {
		setPendingAction("approve");
		try {
			const result = await approveWorkflowRuns({
				data: {
					owner,
					repo,
					pullNumber,
					workflowRunIds: pendingWorkflowApprovals.map((a) => a.workflowRunId),
				},
			});
			if (result.ok) {
				const { approved, failed } = result;
				if (failed > 0) {
					toast.warning(
						`Approved ${approved} workflow${approved !== 1 ? "s" : ""}, but ${failed} failed`,
					);
				} else {
					toast.success(
						`Approved ${pendingWorkflowApprovals.length} workflow${pendingWorkflowApprovals.length !== 1 ? "s" : ""}`,
					);
				}
				await queryClient.invalidateQueries({
					queryKey: statusQueryKey,
					exact: true,
					refetchType: "active",
				});
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			toast.error("Failed to approve workflows");
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3 text-left transition-colors hover:bg-item-hover"
				>
					<div className="mt-0.5 shrink-0">
						<StatusIcon status={checkStatus} />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="text-[13px] font-medium text-foreground">{title}</p>
						<p className="text-xs text-muted-foreground">{description}</p>
					</div>
					<div className="mt-0.5 shrink-0 text-muted-foreground">
						<ChevronRightIcon
							size={14}
							strokeWidth={2}
							className={cn(
								"transition-transform duration-150",
								open && "rotate-90",
							)}
						/>
					</div>
				</button>
			</CollapsibleTrigger>
			{pendingWorkflowApprovals.length > 0 && (
				<div className="flex items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3">
					<div className="mt-0.5 shrink-0 text-pill-warning-text">
						<AlertCircleIcon size={16} strokeWidth={2} />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="text-sm font-medium">
							{pendingWorkflowApprovals.length} workflow
							{pendingWorkflowApprovals.length !== 1 ? "s" : ""} awaiting
							approval
						</p>
						<p className="text-xs text-muted-foreground">
							This workflow requires approval from a maintainer.
						</p>
					</div>
					<Button
						size="xs"
						variant="outline"
						disabled={isApproving}
						className="shrink-0"
						iconLeft={isApproving ? <Spinner size={12} /> : undefined}
						onClick={() => void handleApprove()}
					>
						Approve workflows to run
					</Button>
				</div>
			)}
			<CollapsibleContent>
				<div className="flex max-h-64 flex-col overflow-y-auto border-b-[0.5px] border-card-border bg-surface-1/50">
					{checkRunGroups.map(({ key, label }) => {
						const runs = groupedRuns[key];
						if (runs.length === 0) return null;
						return (
							<div key={key} className="flex flex-col py-1">
								<div className="px-4 pt-1 pb-0.5 pl-11 text-[11px] font-medium text-muted-foreground">
									{label}
								</div>
								{runs.map((run) => {
									const runStatus = getCheckState(run);
									const detail =
										runStatus === "expected"
											? "Waiting for status to be reported"
											: runStatus === "pending" && run.startedAt
												? `Started ${formatRelativeTime(run.startedAt)}`
												: run.outputTitle;
									const nameContent = (
										<>
											<span>{run.name}</span>
											{detail && (
												<span className="text-muted-foreground">
													{" — "}
													{detail}
												</span>
											)}
										</>
									);
									return (
										<div
											key={`${run.name}:${run.id}`}
											className="group/run flex items-center gap-2 px-4 py-1.5 pl-11"
										>
											<CheckStateIcon state={runStatus} />
											{run.appAvatarUrl && (
												<img
													src={run.appAvatarUrl}
													alt=""
													className="size-4 shrink-0 rounded border-[0.5px] border-border"
												/>
											)}
											{run.workflowRunId != null ? (
												<Link
													to="/$owner/$repo/actions/runs/$runId"
													params={{
														owner,
														repo,
														runId: String(run.workflowRunId),
													}}
													search={{ pr: pullNumber }}
													className="min-w-0 flex-1 truncate text-xs hover:underline"
												>
													{nameContent}
												</Link>
											) : run.htmlUrl ? (
												<a
													href={run.htmlUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="min-w-0 flex-1 truncate text-xs hover:underline"
												>
													{nameContent}
												</a>
											) : (
												<span className="min-w-0 flex-1 truncate text-xs">
													{nameContent}
												</span>
											)}
											{run.required && (
												<StatePill
													tone="muted"
													className="-my-0.5 border-[0.5px] border-border bg-transparent"
												>
													Required
												</StatePill>
											)}
											<span
												className={cn(
													"shrink-0 text-xs capitalize",
													runStatus === "success" && "text-success",
													runStatus === "failure" && "text-danger",
													runStatus === "pending" && "text-pill-warning-text",
													runStatus === "expected" && "text-pill-warning-text",
													runStatus === "skipped" && "text-muted-foreground",
												)}
											>
												{runStatus === "success"
													? "Passed"
													: runStatus === "failure"
														? "Failed"
														: runStatus === "pending"
															? "Pending"
															: runStatus === "expected"
																? "Expected"
																: "Skipped"}
											</span>
										</div>
									);
								})}
							</div>
						);
					})}
				</div>
				{(hasCheckFailures || checks.total > 0) && (
					<div className="flex items-center gap-2 border-b-[0.5px] border-card-border px-4 py-1.5 pl-11">
						{hasCheckFailures && (
							<Button
								variant="ghost"
								size="xs"
								disabled={isRerunning}
								className="h-6 text-xs text-muted-foreground"
								iconLeft={
									isRerunning ? (
										<Spinner size={12} />
									) : (
										<RefreshCwIcon size={12} strokeWidth={2} />
									)
								}
								onClick={() => void handleRerun(true)}
							>
								Re-run failed checks
							</Button>
						)}
						{checks.total > 0 && (
							<Button
								variant="ghost"
								size="xs"
								disabled={isRerunning}
								className="h-6 text-xs text-muted-foreground"
								iconLeft={
									isRerunning ? (
										<Spinner size={12} />
									) : (
										<RefreshCwIcon size={12} strokeWidth={2} />
									)
								}
								onClick={() => void handleRerun(false)}
							>
								Re-run all checks
							</Button>
						)}
					</div>
				)}
			</CollapsibleContent>
		</Collapsible>
	);
}

// ── Conflicts section ──────────────────────────────────────────────

function ConflictsSection({
	conflictingFiles,
}: {
	conflictingFiles: string[];
}) {
	const [open, setOpen] = useState(conflictingFiles.length > 0);
	const hasFiles = conflictingFiles.length > 0;

	if (!hasFiles) {
		return (
			<StatusRow
				icon={<StatusIcon status="error" />}
				title="This branch has conflicts that must be resolved"
				description="Use the command line to resolve conflicts."
			/>
		);
	}

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3 text-left transition-colors hover:bg-item-hover"
				>
					<div className="mt-0.5 shrink-0">
						<StatusIcon status="error" />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="text-sm font-medium">
							This branch has conflicts that must be resolved
						</p>
						<p className="text-xs text-muted-foreground">
							{conflictingFiles.length} conflicting file
							{conflictingFiles.length !== 1 ? "s" : ""}
						</p>
					</div>
					<div className="mt-0.5 shrink-0 text-muted-foreground">
						<ChevronRightIcon
							size={14}
							strokeWidth={2}
							className={cn(
								"transition-transform duration-150",
								open && "rotate-90",
							)}
						/>
					</div>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="flex max-h-64 flex-col overflow-y-auto border-b-[0.5px] border-card-border py-1">
					{conflictingFiles.map((file) => (
						<div
							key={file}
							className="flex items-center gap-2 px-4 py-1.5 pl-11"
						>
							<span className="min-w-0 truncate font-mono text-xs">{file}</span>
						</div>
					))}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

// ── Branch status section ───────────────────────────────────────────

function UpdateBranchButton({
	owner,
	repo,
	pullNumber,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const [isUpdating, setIsUpdating] = useState(false);
	const queryClient = useQueryClient();

	const handleUpdate = async () => {
		setIsUpdating(true);
		try {
			const result = await updatePullBranch({
				data: { owner, repo, pullNumber },
			});
			if (result.ok) {
				await invalidateGitHubEntities(queryClient, null, [
					pullEntityKey({ owner, repo, pullNumber }),
					repoEntityKey({ owner, repo }),
				]);
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
				setIsUpdating(false);
			}
		} catch {
			toast.error("Failed to update branch");
			setIsUpdating(false);
		}
	};

	return (
		<div className="flex overflow-hidden rounded-md shadow-button">
			<Button
				variant="outline"
				size="xs"
				disabled={isUpdating}
				className="rounded-r-none"
				iconLeft={
					isUpdating ? (
						<Spinner size={12} />
					) : (
						<RefreshCwIcon size={12} strokeWidth={2} />
					)
				}
				onClick={() => {
					void handleUpdate();
				}}
			>
				Update branch
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="xs"
						disabled={isUpdating}
						className="rounded-l-none border-l-[0.5px] border-l-secondary-foreground/10 px-1"
					>
						<ChevronDownIcon size={12} strokeWidth={2} />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-72">
					<DropdownMenuItem
						onClick={() => {
							void handleUpdate();
						}}
					>
						<div className="flex flex-col gap-0.5">
							<span className="flex items-center gap-1.5 font-medium">
								<CheckIcon size={12} strokeWidth={2} />
								Update with merge commit
							</span>
							<span className="pl-[18px] text-xs text-muted-foreground">
								The merge commit will be associated with your account.
							</span>
						</div>
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => {
							void handleUpdate();
						}}
					>
						<div className="flex flex-col gap-0.5">
							<span className="pl-[18px] font-medium">Update with rebase</span>
							<span className="pl-[18px] text-xs text-muted-foreground">
								This pull request will be rebased on top of the latest changes
								and then force pushed.
							</span>
						</div>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

// ── Ready for review footer ─────────────────────────────────────────

function ReadyForReviewFooter({
	owner,
	repo,
	pullNumber,
	pullId,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	pullId: string | undefined;
}) {
	const [isMarking, setIsMarking] = useState(false);
	const queryClient = useQueryClient();

	const handleMarkReady = async () => {
		if (!pullId) {
			toast.error("Missing pull request id");
			return;
		}
		setIsMarking(true);
		try {
			const result = await markPullReadyForReview({
				data: { owner, repo, pullNumber, pullId },
			});
			if (result.ok) {
				await invalidateGitHubEntities(queryClient, null, [
					pullEntityKey({ owner, repo, pullNumber }),
				]);
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
				setIsMarking(false);
			}
		} catch {
			toast.error("Failed to mark as ready for review");
			setIsMarking(false);
		}
	};

	return (
		<div className="flex items-center gap-3 px-4 py-3">
			<Button
				size="sm"
				disabled={isMarking || !pullId}
				onClick={() => {
					void handleMarkReady();
				}}
				iconLeft={
					isMarking ? (
						<Spinner size={14} />
					) : (
						<GitPullRequestIcon size={14} strokeWidth={2} />
					)
				}
			>
				Ready for review
			</Button>
			<p className="text-xs text-muted-foreground">
				This pull request is a draft. Mark it as ready for review to allow
				merging.
			</p>
		</div>
	);
}

// ── Merge footer ────────────────────────────────────────────────────

const MERGE_STRATEGIES = [
	{ value: "merge" as const, label: "Create a merge commit" },
	{ value: "squash" as const, label: "Squash and merge" },
	{ value: "rebase" as const, label: "Rebase and merge" },
];

function MergeFooter({
	scope,
	isMergeBlocked,
	canMerge,
	bypass,
	owner,
	repo,
	pullNumber,
	prTitle,
	firstCommitMessage,
}: {
	scope: GitHubQueryScope;
	isMergeBlocked: boolean;
	canMerge: boolean;
	bypass: ReturnType<typeof useMergeBypass>;
	owner: string;
	repo: string;
	pullNumber: number;
	prTitle: string;
	firstCommitMessage?: string;
}) {
	const [mergeMethod, setMergeMethod] = useState<"merge" | "squash" | "rebase">(
		"squash",
	);
	const [phase, setPhase] = useState<"idle" | "confirming" | "merging">("idle");
	const isMerging = phase === "merging";
	const showCommitForm = phase !== "idle";
	const [commitTitle, setCommitTitle] = useState("");
	const [commitDescription, setCommitDescription] = useState("");
	const queryClient = useQueryClient();

	const currentStrategy =
		MERGE_STRATEGIES.find((s) => s.value === mergeMethod) ??
		MERGE_STRATEGIES[0];

	const getDefaultCommitTitle = useCallback(() => {
		if (mergeMethod === "squash") {
			return (
				firstCommitMessage?.split("\n")[0] ?? `${prTitle} (#${pullNumber})`
			);
		}
		return `Merge pull request #${pullNumber}`;
	}, [mergeMethod, firstCommitMessage, prTitle, pullNumber]);

	const openCommitForm = () => {
		setCommitTitle(getDefaultCommitTitle());
		setCommitDescription("");
		setPhase("confirming");
	};

	const handleMerge = async () => {
		setPhase("merging");
		try {
			const result = await mergePullRequest({
				data: {
					owner,
					repo,
					pullNumber,
					mergeMethod,
					bypassProtections: bypass.shouldBypass,
					commitTitle: commitTitle || undefined,
					commitMessage: commitDescription || undefined,
				},
			});
			if (result.ok) {
				removePullFromOpenViews(queryClient, scope, {
					owner,
					repo,
					pullNumber,
				});
				await invalidateGitHubEntities(queryClient, scope, [
					pullEntityKey({ owner, repo, pullNumber }),
					repoEntityKey({ owner, repo }),
				]);
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
				setPhase("confirming");
			}
		} catch {
			toast.error("Failed to merge pull request");
			setPhase("confirming");
		}
	};

	const isDisabled =
		!canMerge || (isMergeBlocked && !bypass.shouldBypass) || isMerging;

	if (!canMerge) return null;

	if (showCommitForm) {
		return (
			<div className="flex flex-col gap-3 px-4 py-3">
				<div className="flex flex-col gap-1.5">
					<label htmlFor="merge-commit-title" className="text-xs font-medium">
						Commit message
					</label>
					<input
						id="merge-commit-title"
						value={commitTitle}
						onChange={(e) => setCommitTitle(e.target.value)}
						className="flex h-9 w-full rounded-md border-[0.5px] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="merge-commit-desc" className="text-xs font-medium">
						Extended description
					</label>
					<textarea
						id="merge-commit-desc"
						value={commitDescription}
						onChange={(e) => setCommitDescription(e.target.value)}
						placeholder="Add an optional extended description..."
						rows={3}
						className="flex w-full rounded-md border-[0.5px] bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring resize-none"
					/>
				</div>
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						onClick={() => {
							void handleMerge();
						}}
						disabled={isDisabled || !commitTitle.trim()}
						iconLeft={
							isMerging ? (
								<Spinner size={14} />
							) : (
								<GitMergeIcon size={14} strokeWidth={2} />
							)
						}
					>
						Confirm {currentStrategy.label.toLowerCase()}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setPhase("idle")}
						disabled={isMerging}
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 px-4 py-3">
			<div className="flex items-center gap-3">
				<p className="min-w-0 flex-1 text-xs font-[450] text-muted-foreground">
					{isMergeBlocked && !bypass.shouldBypass
						? "Merging is blocked until the required checks and reviews pass."
						: "Ready to merge"}
				</p>
				<div className="flex shrink-0 overflow-hidden rounded-md shadow-[0_1px_1px_0_lch(0_0_0/0.12),0_3px_6px_-2px_lch(0_0_0/0.12)]">
					<button
						type="button"
						disabled={isDisabled}
						onClick={openCommitForm}
						className="flex h-7 items-center gap-1.5 bg-merge pr-2.5 pl-3 text-xs font-medium text-white transition-colors hover:bg-merge-hover disabled:opacity-50"
					>
						{isMerging ? (
							<Spinner size={12} />
						) : (
							<GitMergeIcon size={13} strokeWidth={2} />
						)}
						{currentStrategy.label}
					</button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								disabled={isDisabled}
								aria-label="Merge options"
								className="flex h-7 items-center border-l-[0.5px] border-white/25 bg-merge pr-2 pl-1.5 text-white transition-colors hover:bg-merge-hover disabled:opacity-50"
							>
								<ChevronDownIcon size={13} strokeWidth={2} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-52">
							{MERGE_STRATEGIES.map((strategy) => (
								<DropdownMenuItem
									key={strategy.value}
									onClick={() => setMergeMethod(strategy.value)}
								>
									<span className="flex-1">{strategy.label}</span>
									{strategy.value === mergeMethod ? <MenuCheck /> : null}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			{bypass.showOption && (
				<div className="flex items-center gap-2 text-xs text-pill-warning-text">
					<Checkbox
						id="bypass-checks"
						checked={bypass.checked}
						onCheckedChange={(checked) => bypass.setChecked(checked === true)}
					/>
					<label htmlFor="bypass-checks">
						Merge without waiting for requirements to be met (bypass branch
						protections)
					</label>
				</div>
			)}
		</div>
	);
}

// ── Shared UI primitives ────────────────────────────────────────────

function StatusRow({
	icon,
	title,
	description,
	action,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3">
			<div className="mt-0.5 shrink-0">{icon}</div>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-[13px] font-medium text-foreground">{title}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}

type StatusType = "success" | "error" | "pending";

function StatusIcon({ status }: { status: StatusType }) {
	if (status === "success") {
		return (
			<div className="flex size-4 items-center justify-center rounded-full bg-review-approved text-white">
				<CheckIcon size={10} strokeWidth={3} />
			</div>
		);
	}
	if (status === "error") {
		return (
			<div className="flex size-4 items-center justify-center rounded-full bg-review-changes text-white">
				<XIcon size={10} strokeWidth={3} />
			</div>
		);
	}
	return (
		<div className="flex size-4 items-center justify-center rounded-full border-2 border-review-required text-review-required">
			<div className="size-1.5 rounded-full bg-current" />
		</div>
	);
}

function MergeStatusSkeleton() {
	return (
		<div className="-mx-3 flex flex-col overflow-hidden rounded-lg bg-card shadow-card">
			{[0, 1, 2].map((item) => (
				<div
					key={item}
					className={cn(
						"flex items-start gap-3 px-4 py-3",
						item < 2 && "border-b-[0.5px] border-card-border",
					)}
				>
					<Skeleton className="mt-0.5 size-4 rounded-full" />
					<div className="flex flex-1 flex-col gap-1.5">
						<Skeleton className="h-3.5 w-48" />
						<Skeleton className="h-3 w-72" />
					</div>
				</div>
			))}
		</div>
	);
}

type TimelineItem =
	| { type: "comment"; date: string; data: PullComment }
	| { type: "commit"; date: string; data: PullCommit }
	| { type: "event"; date: string; data: TimelineEvent }
	| { type: "label_group"; date: string; data: GroupedLabelEvent }
	| {
			type: "review_request_group";
			date: string;
			data: GroupedReviewRequestEvent;
	  }
	| {
			type: "issue_state_toggle_group";
			date: string;
			data: GroupedIssueStateToggleEvent;
	  }
	| { type: "merged"; date: string; data: PullDetail };

const WINDOW_THRESHOLD = 25;
const EDGE_SIZE = 10;
const LOAD_MORE_CHUNK = 20;

function useWindowedTimeline<T>(
	items: T[],
	pagination?: {
		commentPagination?: CommentPagination;
		eventPagination?: EventPagination;
		pageQueryKey: readonly unknown[];
		owner: string;
		repo: string;
		issueNumber: number;
	},
) {
	const queryClient = useQueryClient();
	const [revealedCount, setRevealedCount] = useState(0);
	const [isFetchingPage, setIsFetchingPage] = useState(false);
	const loadedCommentPagesRef = useRef<Set<number>>(new Set());
	const loadedEventPagesRef = useRef<Set<number>>(new Set());
	const hasMoreEventsRef = useRef(
		pagination?.eventPagination?.hasMore ?? false,
	);

	const totalCommentPages = pagination?.commentPagination
		? Math.max(
				1,
				Math.ceil(
					pagination.commentPagination.totalCount /
						pagination.commentPagination.perPage,
				),
			)
		: 1;

	// Sync loaded pages from pagination data
	if (pagination?.commentPagination) {
		for (const p of pagination.commentPagination.loadedPages) {
			loadedCommentPagesRef.current.add(p);
		}
	}
	if (pagination?.eventPagination) {
		for (const p of pagination.eventPagination.loadedPages) {
			loadedEventPagesRef.current.add(p);
		}
		hasMoreEventsRef.current = pagination.eventPagination.hasMore;
	}

	const hasUnfetchedCommentPages =
		totalCommentPages > 1 &&
		loadedCommentPagesRef.current.size < totalCommentPages;
	const hasUnfetchedEventPages = hasMoreEventsRef.current;
	const hasUnfetchedPages = hasUnfetchedCommentPages || hasUnfetchedEventPages;

	const needsWindowing = items.length > WINDOW_THRESHOLD || hasUnfetchedPages;

	const clientHiddenCount = needsWindowing
		? Math.max(0, items.length - EDGE_SIZE * 2 - revealedCount)
		: 0;

	const hiddenCount = clientHiddenCount;

	const visibleItems =
		needsWindowing && clientHiddenCount > 0
			? [
					...items.slice(0, EDGE_SIZE + revealedCount),
					...items.slice(items.length - EDGE_SIZE),
				]
			: items;

	const showLoadMore = needsWindowing && (hiddenCount > 0 || hasUnfetchedPages);
	const loadMoreIndex = showLoadMore ? EDGE_SIZE + revealedCount : -1;

	const loadMore = useCallback(() => {
		// If we have client-side hidden items, reveal a chunk first
		if (clientHiddenCount > 0) {
			setRevealedCount((prev) => prev + LOAD_MORE_CHUNK);
			return;
		}

		if (!pagination) return;

		// Fetch next comment page or event page
		const hasMoreComments = hasUnfetchedCommentPages;
		const hasMoreEvents = hasUnfetchedEventPages;

		if (!hasMoreComments && !hasMoreEvents) return;

		setIsFetchingPage(true);

		const fetches: Promise<void>[] = [];

		// Fetch next comment page
		if (hasMoreComments) {
			let nextPage = -1;
			for (let p = 2; p < totalCommentPages; p++) {
				if (!loadedCommentPagesRef.current.has(p)) {
					nextPage = p;
					break;
				}
			}
			if (nextPage !== -1) {
				fetches.push(
					getCommentPage({
						data: {
							owner: pagination.owner,
							repo: pagination.repo,
							issueNumber: pagination.issueNumber,
							page: nextPage,
						},
					}).then((result) => {
						const newComments = result.comments;
						loadedCommentPagesRef.current.add(nextPage);
						queryClient.setQueryData(
							pagination.pageQueryKey,
							(prev: PullPageData | undefined) => {
								if (!prev) return prev;
								const existingIds = new Set(prev.comments.map((c) => c.id));
								const uniqueNew = newComments.filter(
									(c) => !existingIds.has(c.id),
								);
								return {
									...prev,
									comments: [...prev.comments, ...uniqueNew],
									commentPagination: {
										...prev.commentPagination,
										loadedPages: [...loadedCommentPagesRef.current],
									},
								};
							},
						);
					}),
				);
			}
		}

		// Fetch next event page
		if (hasMoreEvents) {
			const nextEventPage = Math.max(...loadedEventPagesRef.current, 0) + 1;
			fetches.push(
				getTimelineEventPage({
					data: {
						owner: pagination.owner,
						repo: pagination.repo,
						issueNumber: pagination.issueNumber,
						page: nextEventPage,
					},
				}).then((result) => {
					loadedEventPagesRef.current.add(nextEventPage);
					hasMoreEventsRef.current = result.hasMore;
					queryClient.setQueryData(
						pagination.pageQueryKey,
						(prev: PullPageData | undefined) => {
							if (!prev) return prev;
							const existingKeys = new Set(
								prev.events.map((e) => `${e.event}-${e.id}-${e.createdAt}`),
							);
							const uniqueNew = result.events.filter(
								(e) => !existingKeys.has(`${e.event}-${e.id}-${e.createdAt}`),
							);
							return {
								...prev,
								events: [...prev.events, ...uniqueNew],
								eventPagination: {
									loadedPages: [...loadedEventPagesRef.current],
									hasMore: result.hasMore,
								},
							};
						},
					);
				}),
			);
		}

		Promise.all(fetches).finally(() => {
			setIsFetchingPage(false);
		});
	}, [
		clientHiddenCount,
		pagination,
		hasUnfetchedCommentPages,
		hasUnfetchedEventPages,
		totalCommentPages,
		queryClient,
	]);

	return {
		visibleItems,
		hiddenCount,
		hasMorePages: hasUnfetchedPages,
		loadMoreIndex,
		loadMore,
		isFetchingPage,
	};
}

function ActivityTimeline({
	comments,
	commits,
	events,
	reviewComments,
	pr,
	commentPagination,
	eventPagination,
	pageQueryKey,
	owner,
	repo,
	pullNumber,
	scope,
	viewerLogin,
	threadInfoByCommentId,
}: {
	comments: PullComment[];
	commits: PullCommit[];
	events: TimelineEvent[];
	reviewComments: PullReviewComment[];
	pr: PullDetail;
	commentPagination?: CommentPagination;
	eventPagination?: EventPagination;
	pageQueryKey: readonly unknown[];
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
	viewerLogin?: string;
	threadInfoByCommentId?: ReadonlyMap<
		number,
		{ threadId: string; isResolved: boolean }
	>;
}) {
	// Group review comments by their review ID for rendering under reviewed events
	// Also build a replies map keyed by parent comment ID
	const { reviewCommentsByReviewId, repliesByCommentId } = useMemo(() => {
		const byReview = new Map<number, PullReviewComment[]>();
		const replies = new Map<number, PullReviewComment[]>();
		for (const comment of reviewComments) {
			if (comment.inReplyToId != null) {
				const existing = replies.get(comment.inReplyToId) ?? [];
				existing.push(comment);
				replies.set(comment.inReplyToId, existing);
				continue;
			}
			if (comment.pullRequestReviewId == null) continue;
			const existing = byReview.get(comment.pullRequestReviewId) ?? [];
			existing.push(comment);
			byReview.set(comment.pullRequestReviewId, existing);
		}
		return { reviewCommentsByReviewId: byReview, repliesByCommentId: replies };
	}, [reviewComments]);

	const {
		repliesByCommentId: issueCommentReplies,
		replyIds: issueCommentReplyIds,
	} = useMemo(() => buildCommentThreads(comments), [comments]);

	const allItems = groupTimelineEvents(
		[
			...comments
				.filter((c) => !issueCommentReplyIds.has(c.id))
				.map((comment) => ({
					type: "comment" as const,
					date: comment.createdAt,
					data: comment,
				})),
			...commits.map((commit) => ({
				type: "commit" as const,
				date: commit.createdAt,
				data: commit,
			})),
			...events
				.filter((event) => !(event.event === "closed" && pr.isMerged))
				.map((event) => ({
					type: "event" as const,
					date: event.createdAt,
					data: event,
				})),
			...(pr.isMerged && pr.mergedAt
				? [{ type: "merged" as const, date: pr.mergedAt, data: pr }]
				: []),
		].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
	) as TimelineItem[];

	const {
		visibleItems,
		hiddenCount,
		hasMorePages,
		loadMoreIndex,
		loadMore,
		isFetchingPage,
	} = useWindowedTimeline(allItems, {
		commentPagination,
		eventPagination,
		pageQueryKey,
		owner,
		repo,
		issueNumber: pullNumber,
	});

	if (visibleItems.length === 0 && !pr.isMerged) return null;

	return (
		<div className="relative flex flex-col">
			{visibleItems.map((item, index) => {
				const previousType = index > 0 ? visibleItems[index - 1].type : null;
				const nextType =
					index < visibleItems.length - 1 ? visibleItems[index + 1].type : null;
				const isConsecutiveCommit =
					item.type === "commit" && previousType === "commit";
				const isLastInCommitRun =
					item.type === "commit" && nextType !== "commit";
				const eventLikeTypes = new Set([
					"event",
					"label_group",
					"review_request_group",
					"issue_state_toggle_group",
				]);
				const isEventLike = eventLikeTypes.has(item.type);
				const prevIsEventLike =
					previousType !== null && eventLikeTypes.has(previousType);
				const nextIsEventLike =
					nextType !== null && eventLikeTypes.has(nextType);
				const isConsecutiveEvent = isEventLike && prevIsEventLike;
				const isLastInEventRun = isEventLike && !nextIsEventLike;

				const row = (() => {
					if (item.type === "comment") {
						const comment = item.data;
						const commentReplies = issueCommentReplies.get(comment.id);
						return (
							<PullCommentWithThread
								key={`comment-${comment.id}`}
								comment={comment}
								replies={commentReplies}
								isFirst={index === 0}
								owner={owner}
								repo={repo}
								pullNumber={pullNumber}
								scope={scope}
								viewerLogin={viewerLogin}
							/>
						);
					}

					if (item.type === "commit") {
						const commit = item.data;
						const firstLine = commit.message.split("\n")[0];
						return (
							<div
								key={`commit-${commit.sha}`}
								className={cn(
									"flex items-start gap-[9px]",
									index === 0 ? "pt-5" : isConsecutiveCommit ? "pt-2" : "pt-5",
									isLastInCommitRun ? "pb-5" : "pb-2",
								)}
							>
								<div className="flex h-[17px] w-[18px] shrink-0 items-center justify-center rounded-[4px] bg-main text-muted-foreground [&_svg]:size-3.5">
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
										className="mt-[3px] size-3.5 shrink-0 self-start rounded-full ring-[0.5px] ring-chip-border"
									/>
								) : (
									<div className="size-3.5 shrink-0 rounded-full bg-group" />
								)}
								<span className="min-w-0 truncate text-xs leading-5 font-[450] text-text-header">
									{firstLine}
								</span>
								<code className="ml-auto shrink-0 font-mono text-[11px] text-icon-faint">
									{commit.sha.slice(0, 7)}
								</code>
								<span className="shrink-0 text-xs font-[450] tabular-nums text-icon-faint">
									{formatRelativeTime(commit.createdAt)}
								</span>
							</div>
						);
					}

					if (item.type === "merged") {
						const mergedPr = item.data;
						return (
							<div
								key="merged"
								className={cn(
									"flex items-center gap-1.5 pb-5",
									index === 0 ? "pt-5" : "pt-5",
								)}
							>
								<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-merged text-white">
									<GitMergeIcon size={12} strokeWidth={2} />
								</div>
								{mergedPr.mergedBy ? (
									<img
										src={mergedPr.mergedBy.avatarUrl}
										alt={mergedPr.mergedBy.login}
										className="mt-[3px] size-3.5 shrink-0 self-start rounded-full ring-[0.5px] ring-chip-border"
									/>
								) : (
									<div className="size-3.5 shrink-0 rounded-full bg-group" />
								)}
								<span className="text-[13px]">
									<span className="font-medium">
										{mergedPr.mergedBy?.login ?? "Unknown"}
									</span>
									{" merged commit "}
									{mergedPr.mergeCommitSha && (
										<code className="font-mono text-[11px] text-icon-faint">
											{mergedPr.mergeCommitSha.slice(0, 7)}
										</code>
									)}
									{" into "}
									<code className="font-mono text-[11px] text-icon-faint">
										{mergedPr.baseRefName}
									</code>
								</span>
								<span className="ml-auto shrink-0 text-xs font-[450] tabular-nums text-icon-faint">
									{formatRelativeTime(mergedPr.mergedAt as string)}
								</span>
							</div>
						);
					}

					if (
						item.type === "label_group" ||
						item.type === "review_request_group"
					) {
						const group = item.data;
						const hasActorAvatar = group.actor?.avatarUrl;
						const icon =
							item.type === "label_group" ? (
								<svg
									viewBox="0 0 16 16"
									className="size-3 text-muted-foreground"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M2.5 7.775V3a.5.5 0 0 1 .5-.5h4.775a.75.75 0 0 1 .53.22l5.92 5.92a.75.75 0 0 1 0 1.06l-4.775 4.775a.75.75 0 0 1-1.06 0l-5.92-5.92a.75.75 0 0 1-.22-.53zM5 5.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0z" />
								</svg>
							) : (
								<ReviewsIcon
									size={12}
									strokeWidth={2}
									className="text-muted-foreground"
								/>
							);
						return (
							<div
								key={`${item.type}-${group.createdAt}`}
								className={cn(
									"flex items-start gap-[9px]",
									index === 0 ? "pt-5" : isConsecutiveEvent ? "pt-2" : "pt-5",
									isLastInEventRun ? "pb-5" : "pb-2",
								)}
							>
								{hasActorAvatar ? (
									<img
										src={group.actor?.avatarUrl}
										alt={group.actor?.login}
										className="mt-[3px] size-3.5 shrink-0 self-start rounded-full ring-[0.5px] ring-chip-border"
									/>
								) : (
									<div className="flex h-[17px] w-[18px] shrink-0 items-center justify-center self-start rounded-[4px] bg-main text-muted-foreground mt-[1.5px] [&_svg]:size-3.5">
										{icon}
									</div>
								)}
								<span className="min-w-0 text-xs leading-5 font-[450] text-muted-foreground">
									{item.type === "label_group" ? (
										<GroupedLabelDescription
											group={item.data as GroupedLabelEvent}
										/>
									) : (
										<GroupedReviewRequestDescription
											group={item.data as GroupedReviewRequestEvent}
										/>
									)}
								</span>
								<span className="ml-auto shrink-0 text-xs font-[450] tabular-nums text-icon-faint">
									{formatRelativeTime(group.createdAt)}
								</span>
							</div>
						);
					}

					if (item.type === "issue_state_toggle_group") {
						const group = item.data as GroupedIssueStateToggleEvent;
						const hasActorAvatar = group.actor?.avatarUrl;
						const prClosed =
							pr.state === "closed" && !pr.isMerged ? "closed" : undefined;
						const mergedForIcon = group.events.map((e) =>
							e.event === "closed"
								? mergeIssueStateIntoCloseEvent(e, {
										issueState: prClosed,
										issueClosedAt: pr.closedAt,
										issueStateReason: null,
									})
								: e,
						);
						const lastEvent = mergedForIcon[mergedForIcon.length - 1];
						const icon = lastEvent ? getEventIcon(lastEvent) : null;
						const toggleKey = group.events.map((e) => e.id).join("-");
						return (
							<div
								key={`issue_state_toggle_group-${toggleKey}-${group.createdAt}`}
								className={cn(
									"flex items-start gap-[9px]",
									index === 0 ? "pt-5" : isConsecutiveEvent ? "pt-2" : "pt-5",
									isLastInEventRun ? "pb-5" : "pb-2",
								)}
							>
								{hasActorAvatar ? (
									<img
										src={group.actor?.avatarUrl}
										alt={group.actor?.login}
										className="mt-[3px] size-3.5 shrink-0 self-start rounded-full ring-[0.5px] ring-chip-border"
									/>
								) : (
									<div className="flex h-[17px] w-[18px] shrink-0 items-center justify-center self-start rounded-[4px] bg-main text-muted-foreground mt-[1.5px] [&_svg]:size-3.5">
										{icon}
									</div>
								)}
								<span className="min-w-0 text-xs leading-5 font-[450] text-muted-foreground">
									<GroupedIssueStateToggleDescription
										group={group}
										subject="pull"
										mergeCloseReason={(e) =>
											e.event === "closed"
												? mergeIssueStateIntoCloseEvent(e, {
														issueState: prClosed,
														issueClosedAt: pr.closedAt,
														issueStateReason: null,
													})
												: e
										}
									/>
								</span>
								<span className="ml-auto shrink-0 text-xs font-[450] tabular-nums text-icon-faint">
									{formatRelativeTime(group.createdAt)}
								</span>
							</div>
						);
					}

					const event = item.data;
					return (
						<TimelineEventRow
							key={`event-${event.event}-${event.id}-${event.createdAt}`}
							event={event}
							isFirst={index === 0}
							isConsecutive={isConsecutiveEvent}
							isLastInRun={isLastInEventRun}
							headRefName={pr.headRefName}
							reviewComments={
								event.event === "reviewed"
									? reviewCommentsByReviewId.get(event.id)
									: undefined
							}
							repliesByCommentId={repliesByCommentId}
							owner={owner}
							repo={repo}
							pullNumber={pullNumber}
							viewerLogin={viewerLogin}
							threadInfoByCommentId={threadInfoByCommentId}
						/>
					);
				})();

				return (
					<>
						{index === loadMoreIndex && (
							<LoadMoreDivider
								key="load-more"
								hiddenCount={hiddenCount}
								hasMorePages={hasMorePages}
								isPending={isFetchingPage}
								onLoadMore={loadMore}
							/>
						)}
						{row}
					</>
				);
			})}
		</div>
	);
}

function LoadMoreDivider({
	hiddenCount,
	hasMorePages,
	isPending,
	onLoadMore,
}: {
	hiddenCount: number;
	hasMorePages?: boolean;
	isPending?: boolean;
	onLoadMore: () => void;
}) {
	const label =
		hiddenCount > 0
			? `${hiddenCount}${hasMorePages ? "+" : ""} more ${hiddenCount === 1 && !hasMorePages ? "item" : "items"}`
			: "Load more";

	return (
		<div className="flex items-center gap-3 py-3">
			<div className="h-px flex-1 bg-border" />
			<button
				type="button"
				onClick={onLoadMore}
				disabled={isPending}
				className={cn(
					"flex shrink-0 items-center gap-1.5 rounded-md border-[0.5px] border-border bg-surface-1 px-3 py-1 text-xs text-muted-foreground transition-colors",
					isPending
						? "cursor-not-allowed opacity-60"
						: "hover:bg-ghost-hover hover:text-foreground",
				)}
			>
				{isPending ? (
					<svg
						className="size-3 animate-spin"
						viewBox="0 0 16 16"
						fill="none"
						aria-hidden="true"
					>
						<circle
							cx="8"
							cy="8"
							r="6.5"
							stroke="currentColor"
							strokeWidth="2"
							opacity="0.25"
						/>
						<path
							d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
				) : (
					<ChevronDownIcon size={12} strokeWidth={2} />
				)}
				{label}
			</button>
			<div className="h-px flex-1 bg-border" />
		</div>
	);
}

// ── Timeline event row ──────────────────────────────────────────────

function TimelineEventRow({
	event,
	isFirst,
	isConsecutive,
	isLastInRun,
	headRefName,
	reviewComments,
	repliesByCommentId,
	owner,
	repo,
	pullNumber,
	viewerLogin,
	threadInfoByCommentId,
}: {
	event: TimelineEvent;
	isFirst: boolean;
	isConsecutive: boolean;
	isLastInRun: boolean;
	headRefName: string;
	reviewComments?: PullReviewComment[];
	repliesByCommentId?: ReadonlyMap<number, PullReviewComment[]>;
	owner?: string;
	repo?: string;
	pullNumber?: number;
	viewerLogin?: string;
	threadInfoByCommentId?: ReadonlyMap<
		number,
		{ threadId: string; isResolved: boolean }
	>;
}) {
	const icon = getEventIcon(event);
	const description = getEventDescription(event, headRefName);
	const isCrossRef =
		event.event === "cross-referenced" || event.event === "referenced";
	const hasActorAvatar = !isCrossRef && event.actor?.avatarUrl;

	if (!description) return null;

	const hasReviewBody = event.body?.trim();
	const hasReviewComments = reviewComments && reviewComments.length > 0;

	// Reviewed events with a body or inline comments get a richer layout
	if (event.event === "reviewed" && (hasReviewBody || hasReviewComments)) {
		return (
			<div className={cn("flex flex-col gap-2 py-5", isFirst && "pt-5")}>
				<div className="flex items-center gap-1.5">
					{icon}
					<span className="min-w-0 text-xs leading-5 font-[450] text-muted-foreground">
						{description}
					</span>
					{event.createdAt && (
						<span className="ml-auto shrink-0 text-xs font-[450] tabular-nums text-icon-faint">
							{formatRelativeTime(event.createdAt)}
						</span>
					)}
				</div>
				{hasReviewBody && (
					<AppMarkdown
						owner={owner}
						repo={repo}
						className="text-muted-foreground"
					>
						{event.body as string}
					</AppMarkdown>
				)}
				{hasReviewComments && (
					<div className="flex flex-col gap-2">
						{reviewComments.map((comment) => (
							<ReviewCommentBlock
								key={comment.id}
								comment={comment}
								replies={repliesByCommentId?.get(comment.id)}
								owner={owner}
								repo={repo}
								pullNumber={pullNumber}
								viewerLogin={viewerLogin}
								threadInfo={threadInfoByCommentId?.get(comment.id)}
							/>
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex items-start gap-[9px]",
				isFirst ? "pt-5" : isConsecutive ? "pt-2" : "pt-5",
				isLastInRun ? "pb-5" : "pb-2",
			)}
		>
			{hasActorAvatar ? (
				<img
					src={event.actor?.avatarUrl}
					alt={event.actor?.login}
					className="mt-[3px] size-3.5 shrink-0 self-start rounded-full ring-[0.5px] ring-chip-border"
				/>
			) : (
				<div className="flex h-[17px] w-[18px] shrink-0 items-center justify-center self-start rounded-[4px] bg-main text-muted-foreground mt-[1.5px] [&_svg]:size-3.5">
					{icon}
				</div>
			)}
			<span className="min-w-0 text-xs leading-5 font-[450] text-muted-foreground">
				{description}
			</span>
			{event.createdAt && (
				<span className="ml-auto shrink-0 text-xs font-[450] tabular-nums text-icon-faint">
					{formatRelativeTime(event.createdAt)}
				</span>
			)}
		</div>
	);
}

const CONTEXT_LINES_ABOVE = 3;

/**
 * Trim a diff hunk to only show the lines relevant to a review comment.
 * For single-line comments: show CONTEXT_LINES_ABOVE lines above the comment line.
 * For ranged comments: show the full range plus CONTEXT_LINES_ABOVE above the start.
 * The hunk from GitHub always ends at the comment's `line` (the last line of the range).
 */
function trimDiffHunk(
	diffHunk: string,
	commentLine: number | null,
	startLine: number | null,
	side: "LEFT" | "RIGHT",
): string {
	const lines = diffHunk.split("\n");
	const headerIdx = lines.findIndex((l) => l.startsWith("@@"));
	if (headerIdx === -1 || commentLine == null) return diffHunk;

	const header = lines[headerIdx];
	const body = lines.slice(headerIdx + 1);

	const match = header.match(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/,
	);
	if (!match) return diffHunk;

	const oldStart = Number(match[1]);
	const newStart = Number(match[3]);

	// Walk the body to build a mapping of hunk-index → source line number
	// so we can find where `startLine` appears.
	const targetStart = startLine ?? commentLine;
	let oldLine = oldStart;
	let newLine = newStart;
	let firstKeepIdx = body.length; // default: keep nothing extra

	for (let i = 0; i < body.length; i++) {
		const l = body[i];
		const currentLine = side === "LEFT" ? oldLine : newLine;

		if (currentLine >= targetStart && firstKeepIdx === body.length) {
			firstKeepIdx = i;
		}

		if (l.startsWith("-")) {
			oldLine++;
		} else if (l.startsWith("+")) {
			newLine++;
		} else {
			oldLine++;
			newLine++;
		}
	}

	// Add context lines above the range start
	const sliceStart = Math.max(0, firstKeepIdx - CONTEXT_LINES_ABOVE);
	const trimmed = body.slice(sliceStart);

	if (sliceStart === 0) return diffHunk;

	// Count how many old/new lines were dropped to rewrite the header
	let droppedOld = 0;
	let droppedNew = 0;
	for (const line of body.slice(0, sliceStart)) {
		if (line.startsWith("-")) droppedOld++;
		else if (line.startsWith("+")) droppedNew++;
		else {
			droppedOld++;
			droppedNew++;
		}
	}

	const oldCount = Number(match[2] ?? 1);
	const newCount = Number(match[4] ?? 1);
	const newHeader = `@@ -${oldStart + droppedOld},${oldCount - droppedOld} +${newStart + droppedNew},${newCount - droppedNew} @@${match[5]}`;
	return [newHeader, ...trimmed].join("\n");
}

function PullCommentBubble({
	comment,
	owner,
	repo,
	pullNumber,
	scope,
	viewerLogin,
	onReply,
	isReply,
}: {
	comment: PullComment;
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
	viewerLogin?: string;
	onReply?: () => void;
	isReply?: boolean;
}) {
	const [commentActive, setCommentActive] = useState(false);
	const editor = useCommentEditor({
		kind: "issue",
		owner: owner,
		repo: repo,
		number: pullNumber,
		commentId: comment.id,
	});
	const prefersNoHover = usePrefersNoHover();

	return (
		<div
			className="group/comment relative flex flex-col gap-1.5 px-4 py-3"
			onPointerEnter={() => setCommentActive(true)}
			onPointerLeave={() => setCommentActive(false)}
			onFocusCapture={() => setCommentActive(true)}
			onBlurCapture={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
					setCommentActive(false);
				}
			}}
		>
			<div className="flex h-[18.5px] items-center gap-2">
				{comment.author ? (
					<img
						src={comment.author.avatarUrl}
						alt={comment.author.login}
						className="size-[18px] rounded-full ring-[0.5px] ring-chip-border"
					/>
				) : (
					<div className="size-[18px] rounded-full bg-group" />
				)}
				<span className="text-[13px] font-medium text-foreground">
					{comment.author?.login ?? "Unknown"}
				</span>
				<span className="ml-0.5 text-[13px] font-[450] text-icon-faint">
					{formatRelativeTime(comment.createdAt)}
				</span>
				<EditedMark editedAt={comment.editedAt} />
				<div className="ml-auto flex items-center gap-1">
					{onReply && (
						<button
							type="button"
							onClick={onReply}
							aria-label="Reply"
							className="flex size-7 items-center justify-center rounded-md text-text-header opacity-0 transition-opacity hover:bg-ghost-hover group-hover/comment:opacity-100 focus-visible:opacity-100"
						>
							<CommentIcon size={14} strokeWidth={2} />
						</button>
					)}
					<CommentMoreMenu
						commentId={comment.id}
						body={comment.body}
						owner={owner}
						repo={repo}
						number={pullNumber}
						commentType="issue"
						editor={editor}
						isAuthor={
							viewerLogin != null && comment.author?.login === viewerLogin
						}
					/>
				</div>
			</div>
			<div
				className={cn(
					"relative",
					isReply && "pl-[27px]",
					comment.graphqlId != null && "mb-7",
				)}
			>
				<CommentBody
					editor={editor}
					body={comment.body}
					owner={owner}
					repo={repo}
					className="text-[15px] leading-6 text-text-strong"
				/>
				{comment.graphqlId ? (
					<IssueCommentReactionBar
						className="absolute left-0 right-0 top-full z-10 mt-1"
						revealZeroCount={commentActive || prefersNoHover}
						viewerLogin={viewerLogin}
						owner={owner}
						repo={repo}
						issueNumber={pullNumber}
						commentId={comment.id}
						commentGraphqlId={comment.graphqlId}
						scope={scope}
						reactions={comment.reactions}
					/>
				) : null}
			</div>
		</div>
	);
}

function PullCommentWithThread({
	comment,
	replies,
	isFirst,
	owner,
	repo,
	pullNumber,
	scope,
	viewerLogin,
}: {
	comment: PullComment;
	replies?: PullComment[];
	isFirst: boolean;
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
	viewerLogin?: string;
}) {
	const [showReplyForm, setShowReplyForm] = useState(false);
	const hasReplies = replies && replies.length > 0;

	return (
		<div
			className={cn(
				"relative -mx-3 my-2 flex flex-col rounded-lg bg-card shadow-card",
				isFirst && "mt-0",
			)}
		>
			<PullCommentBubble
				comment={comment}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
				scope={scope}
				viewerLogin={viewerLogin}
				onReply={() => setShowReplyForm(true)}
			/>

			{hasReplies && (
				<div className="flex flex-col divide-y-[0.5px] divide-header-rule border-t-[0.5px] border-header-rule">
					{replies.map((reply) => (
						<PullCommentBubble
							key={reply.id}
							comment={reply}
							owner={owner}
							repo={repo}
							pullNumber={pullNumber}
							scope={scope}
							viewerLogin={viewerLogin}
							onReply={() => setShowReplyForm(true)}
							isReply
						/>
					))}
				</div>
			)}

			{showReplyForm && (
				<div className="border-t-[0.5px] border-header-rule px-3 py-3">
					<CommentReplyForm
						owner={owner}
						repo={repo}
						issueNumber={pullNumber}
						parentAuthor={comment.author?.login ?? "Unknown"}
						parentBody={comment.body}
						parentCommentId={comment.id}
						onClose={() => setShowReplyForm(false)}
					/>
				</div>
			)}
		</div>
	);
}

function ReviewCommentBubble({
	comment,
	owner,
	repo,
	pullNumber,
	viewerLogin,
}: {
	comment: PullReviewComment;
	owner?: string;
	repo?: string;
	pullNumber?: number;
	viewerLogin?: string;
}) {
	const editor = useCommentEditor({
		kind: "review",
		owner: owner ?? "",
		repo: repo ?? "",
		number: pullNumber ?? 0,
		commentId: comment.id,
	});
	return (
		<div className="group/comment relative px-3 py-2.5">
			<div className="mb-1.5 flex items-center gap-1.5">
				{comment.author ? (
					<img
						src={comment.author.avatarUrl}
						alt={comment.author.login}
						className="size-4 rounded-full ring-[0.5px] ring-chip-border"
					/>
				) : (
					<div className="size-4 rounded-full bg-surface-2" />
				)}
				<span className="text-[13px] font-medium">
					{comment.author?.login ?? "Unknown"}
				</span>
				<span className="text-[13px] text-muted-foreground">
					{formatRelativeTime(comment.createdAt)}
				</span>
				<EditedMark editedAt={comment.editedAt} />
				{owner && repo && pullNumber != null && (
					<div className="ml-auto">
						<CommentMoreMenu
							commentId={comment.id}
							body={comment.body}
							owner={owner}
							repo={repo}
							number={pullNumber}
							commentType="review"
							editor={editor}
							isAuthor={
								viewerLogin != null && comment.author?.login === viewerLogin
							}
						/>
					</div>
				)}
			</div>
			<CommentBody
				editor={editor}
				body={comment.body}
				owner={owner}
				repo={repo}
				className="text-[15px] leading-6 text-text-strong"
			/>
		</div>
	);
}

function ReviewCommentBlock({
	comment,
	replies,
	owner,
	repo,
	pullNumber,
	viewerLogin,
	threadInfo,
}: {
	comment: PullReviewComment;
	replies?: PullReviewComment[];
	owner?: string;
	repo?: string;
	pullNumber?: number;
	viewerLogin?: string;
	threadInfo?: { threadId: string; isResolved: boolean };
}) {
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const queryClient = useQueryClient();
	const [replyStatus, setReplyStatus] = useState<"closed" | "open" | "sending">(
		"closed",
	);
	const showReplyForm = replyStatus !== "closed";
	const isSending = replyStatus === "sending";
	const [replyBody, setReplyBody] = useState("");
	const [isCollapsed, setIsCollapsed] = useState(
		threadInfo?.isResolved ?? false,
	);
	const [isResolving, setIsResolving] = useState(false);

	const diffOptions = useMemo(
		() => ({
			diffStyle: "unified" as const,
			theme: {
				dark: "quickhub-dark" as const,
				light: "quickhub-light" as const,
			},
			lineDiffType: "none" as const,
			hunkSeparators: "line-info" as const,
			overflow: "scroll" as const,
			disableFileHeader: true,
			unsafeCSS: [
				`:host { color-scheme: ${isDark ? "dark" : "light"}; }`,
				`:host { --diffs-font-family: 'Geist Mono Variable', 'SF Mono', ui-monospace, 'Cascadia Code', monospace; }`,
				`[data-diff] { border: none; border-radius: 0; overflow: hidden; }`,
				`[data-line-annotation] { font-family: 'Inter Variable', 'Inter', 'Avenir Next', ui-sans-serif, system-ui, sans-serif; }`,
				`[data-line-annotation] code { font-family: var(--diffs-font-family, var(--diffs-font-fallback)); }`,
				`[data-annotation-content] { background-color: transparent; }`,
			].join("\n"),
		}),
		[isDark],
	);

	const patch = useMemo(() => {
		const trimmed = trimDiffHunk(
			comment.diffHunk,
			comment.line,
			comment.startLine,
			comment.side,
		);
		return `--- a/${comment.path}\n+++ b/${comment.path}\n${trimmed}`;
	}, [
		comment.diffHunk,
		comment.line,
		comment.startLine,
		comment.side,
		comment.path,
	]);

	const lineAnnotations = useMemo(() => {
		if (comment.line == null) return [];
		return [
			{
				side:
					comment.side === "LEFT"
						? ("deletions" as const)
						: ("additions" as const),
				lineNumber: comment.line,
				metadata: comment,
			},
		];
	}, [comment]);

	const handleReply = useCallback(async () => {
		if (!replyBody.trim() || !owner || !repo || pullNumber == null) return;
		setReplyStatus("sending");
		try {
			const result = await replyToReviewComment({
				data: {
					owner,
					repo,
					pullNumber,
					commentId: comment.id,
					body: replyBody.trim(),
				},
			});
			if (result) {
				setReplyBody("");
				setReplyStatus("closed");
				void invalidateGitHubEntities(queryClient, null, [
					pullEntityKey({ owner, repo, pullNumber }),
				]);
			} else {
				toast.error("Failed to send reply");
				setReplyStatus("open");
			}
		} catch {
			toast.error("Failed to send reply");
			setReplyStatus("open");
		}
	}, [replyBody, owner, repo, pullNumber, comment.id, queryClient]);

	const handleResolve = useCallback(async () => {
		if (!threadInfo || !owner || !repo) return;
		setIsResolving(true);
		try {
			const fn = threadInfo.isResolved
				? unresolveReviewThread
				: resolveReviewThread;
			const result = await fn({
				data: { owner, repo, threadId: threadInfo.threadId },
			});
			if (result.ok) {
				if (!threadInfo.isResolved) setIsCollapsed(true);
				void invalidateGitHubEntities(
					queryClient,
					null,
					owner && repo && pullNumber != null
						? [pullEntityKey({ owner, repo, pullNumber })]
						: [],
				);
			} else {
				toast.error(result.error);
			}
		} catch {
			toast.error("Failed to update thread");
		} finally {
			setIsResolving(false);
		}
	}, [threadInfo, owner, repo, pullNumber, queryClient]);

	const canReply = owner && repo && pullNumber != null;

	const renderAnnotation = useCallback(
		(annotation: DiffLineAnnotation<PullReviewComment>) => {
			const data = annotation.metadata;
			if (!data) return null;
			return (
				<div className="m-2 divide-y-[0.5px] overflow-hidden rounded-lg border-[0.5px] bg-surface-0">
					<ReviewCommentBubble
						comment={data}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						viewerLogin={viewerLogin}
					/>
					{replies?.map((reply) => (
						<ReviewCommentBubble
							key={reply.id}
							comment={reply}
							owner={owner}
							repo={repo}
							pullNumber={pullNumber}
							viewerLogin={viewerLogin}
						/>
					))}
					<div className="flex items-center gap-2 px-3 py-2">
						{showReplyForm ? (
							<div className="flex w-full flex-col gap-2">
								<MarkdownEditor
									value={replyBody}
									onChange={setReplyBody}
									placeholder="Write a reply..."
									compact
								/>
								<div className="flex items-center justify-end gap-2">
									<button
										type="button"
										onClick={() => {
											setReplyStatus("closed");
											setReplyBody("");
										}}
										className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={() => void handleReply()}
										disabled={!replyBody.trim() || isSending}
										className="flex h-7 items-center gap-1.5 rounded-md bg-indigo px-3 text-xs font-medium text-indigo-foreground shadow-[0_1px_1px_0_lch(0_0_0/0.12),0_3px_6px_-2px_lch(0_0_0/0.12)] transition-colors hover:bg-indigo/90 disabled:opacity-50"
									>
										{isSending ? (
											<Spinner className="size-3" />
										) : (
											<CommentIcon size={12} strokeWidth={2} />
										)}
										Reply
									</button>
								</div>
							</div>
						) : (
							<>
								{canReply && (
									<button
										type="button"
										onClick={() => setReplyStatus("open")}
										className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
									>
										<CommentIcon size={12} strokeWidth={2} />
										Reply
									</button>
								)}
								{threadInfo && (
									<button
										type="button"
										onClick={() => void handleResolve()}
										disabled={isResolving}
										className={cn(
											"ml-auto flex items-center gap-1.5 text-xs transition-colors",
											threadInfo.isResolved
												? "text-muted-foreground hover:text-foreground"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{isResolving ? (
											<Spinner className="size-3" />
										) : (
											<CheckIcon size={12} strokeWidth={2} />
										)}
										{threadInfo.isResolved ? "Unresolve" : "Resolve"}
									</button>
								)}
							</>
						)}
					</div>
				</div>
			);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			replies,
			showReplyForm,
			replyBody,
			isSending,
			canReply,
			owner,
			repo,
			pullNumber,
			viewerLogin,
			threadInfo,
			isResolving,
			handleReply,
			handleResolve,
		],
	);

	return (
		<div className="overflow-hidden rounded-lg border-[0.5px]">
			<div className="flex items-center gap-1.5 bg-surface-1 px-3 py-2 text-[13px] text-muted-foreground">
				{threadInfo?.isResolved && (
					<span className="flex items-center gap-1 text-xs font-medium text-success">
						<CheckIcon size={12} strokeWidth={2} />
						Resolved
					</span>
				)}
				<span className="min-w-0 truncate font-mono text-xs font-medium text-foreground">
					{comment.path}
				</span>
				<button
					type="button"
					onClick={() => setIsCollapsed(!isCollapsed)}
					className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground"
					aria-label={isCollapsed ? "Expand thread" : "Collapse thread"}
				>
					{isCollapsed ? (
						<ChevronDownIcon size={14} strokeWidth={2} />
					) : (
						<ChevronUpIcon size={14} strokeWidth={2} />
					)}
				</button>
			</div>
			{!isCollapsed && comment.diffHunk && (
				<Suspense>
					<PatchDiff
						patch={patch}
						options={diffOptions}
						lineAnnotations={lineAnnotations}
						renderAnnotation={renderAnnotation}
					/>
				</Suspense>
			)}
		</div>
	);
}

function getEventIcon(event: TimelineEvent) {
	switch (event.event) {
		case "labeled":
		case "unlabeled":
			return (
				<svg
					viewBox="0 0 16 16"
					className="size-3 text-muted-foreground"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M2.5 7.775V3a.5.5 0 0 1 .5-.5h4.775a.75.75 0 0 1 .53.22l5.92 5.92a.75.75 0 0 1 0 1.06l-4.775 4.775a.75.75 0 0 1-1.06 0l-5.92-5.92a.75.75 0 0 1-.22-.53zM5 5.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0z" />
				</svg>
			);
		case "assigned":
		case "unassigned":
			return (
				<UserAddIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
		case "review_requested":
		case "review_request_removed":
			return (
				<ReviewsIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
		case "reviewed": {
			const s = event.reviewState?.toLowerCase();
			let reviewIconClass = "text-muted-foreground";
			if (s === "approved") {
				reviewIconClass = "text-success";
			} else if (s === "changes_requested") {
				reviewIconClass = "text-danger";
			} else if (s === "commented") {
				reviewIconClass = "text-indigo";
			} else if (s === "dismissed") {
				reviewIconClass = "text-muted-foreground";
			}
			return (
				<ReviewsIcon size={12} strokeWidth={2} className={reviewIconClass} />
			);
		}
		case "renamed":
			return (
				<EditIcon size={12} strokeWidth={2} className="text-muted-foreground" />
			);
		case "closed": {
			const kind = parseCloseReason(event.stateReason);
			if (kind === "completed") {
				return (
					<IssueClosedCompletedIcon
						size={12}
						strokeWidth={2}
						className="text-merged"
					/>
				);
			}
			if (kind === "not_planned") {
				return (
					<IssueClosedNotPlannedIcon
						size={12}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
				);
			}
			return (
				<GitPullRequestClosedIcon
					size={12}
					strokeWidth={2}
					className="text-danger"
				/>
			);
		}
		case "reopened":
			return (
				<GitPullRequestIcon
					size={12}
					strokeWidth={2}
					className="text-success"
				/>
			);
		case "cross-referenced":
		case "referenced":
			return (
				<GitPullRequestIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
		case "milestoned":
		case "demilestoned":
			return (
				<svg
					viewBox="0 0 16 16"
					className="size-3 text-muted-foreground"
					fill="currentColor"
					aria-hidden="true"
				>
					<path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm1.5 4.5h-3v7h1.5v-2h1.5a2 2 0 1 0 0-4zm0 1.5a.5.5 0 1 1 0 1H8V6z" />
				</svg>
			);
		case "convert_to_draft":
			return (
				<GitPullRequestIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
		case "ready_for_review":
			return (
				<GitPullRequestIcon
					size={12}
					strokeWidth={2}
					className="text-success"
				/>
			);
		case "head_ref_deleted":
		case "head_ref_restored":
			return (
				<GitBranchIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
		default:
			return (
				<CircleIcon
					size={12}
					strokeWidth={2}
					className="text-muted-foreground"
				/>
			);
	}
}

function ActorMention({
	actor,
	hideAvatar,
}: {
	actor: { login: string; avatarUrl?: string } | null | undefined;
	hideAvatar?: boolean;
}) {
	const login = actor?.login ?? "someone";
	return (
		<span className="inline-flex items-center gap-1 font-medium text-foreground">
			{!hideAvatar && actor?.avatarUrl && (
				<img
					src={actor.avatarUrl}
					alt={login}
					className="inline-block size-3.5 rounded-full border-[0.5px] border-border align-text-bottom"
				/>
			)}
			{login}
		</span>
	);
}

function getEventDescription(
	event: TimelineEvent,
	headRefName: string,
): React.ReactNode {
	const reviewer =
		event.requestedReviewer ??
		(event.requestedTeam ? { login: event.requestedTeam.name } : null);

	switch (event.event) {
		case "labeled":
			return (
				<span className="flex items-center gap-1.5 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" added "}
					{event.label && (
						<LabelPill
							name={event.label.name}
							color={event.label.color}
							size="sm"
						/>
					)}
				</span>
			);
		case "unlabeled":
			return (
				<span className="flex items-center gap-1.5 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" removed "}
					{event.label && (
						<LabelPill
							name={event.label.name}
							color={event.label.color}
							size="sm"
						/>
					)}
				</span>
			);
		case "assigned":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" assigned "}
					<ActorMention actor={event.assignee} />
				</span>
			);
		case "unassigned":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" unassigned "}
					<ActorMention actor={event.assignee} />
				</span>
			);
		case "review_requested":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" requested review from "}
					<ActorMention actor={reviewer} />
				</span>
			);
		case "review_request_removed":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" removed review request for "}
					<ActorMention actor={reviewer} />
				</span>
			);
		case "reviewed": {
			const state = event.reviewState?.toLowerCase();
			let action: React.ReactNode;
			if (state === "approved") {
				action = (
					<>
						<span className="font-medium text-success">approved</span>
						{" this pull request"}
					</>
				);
			} else if (state === "changes_requested") {
				action = (
					<span className="font-medium text-danger">requested changes</span>
				);
			} else if (state === "commented") {
				action = <span className="font-medium text-indigo">left a review</span>;
			} else if (state === "dismissed") {
				action = (
					<span className="font-medium text-muted-foreground">
						dismissed their review
					</span>
				);
			} else {
				action = "reviewed";
			}
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{action}
				</span>
			);
		}
		case "renamed":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" changed the title from "}
					<span className="line-through">{event.rename?.from}</span>
					{" to "}
					<span className="font-medium text-foreground">
						{event.rename?.to}
					</span>
				</span>
			);
		case "closed": {
			const kind = parseCloseReason(event.stateReason);
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" closed this pull request"}
					{kind === "completed" && (
						<>
							{" as "}
							<span className="font-medium text-merged">completed</span>
						</>
					)}
					{kind === "not_planned" && (
						<>
							{" as "}
							<span className="font-medium text-muted-foreground">
								not planned
							</span>
						</>
					)}
				</span>
			);
		}
		case "reopened":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					<span className="font-medium text-success">reopened</span>
					{" this pull request"}
				</span>
			);
		case "cross-referenced":
		case "referenced": {
			if (!event.source) return null;
			const prefix = event.source.type === "pull_request" ? "PR" : "Issue";
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} />
					{" mentioned this in "}
					<span className="font-medium text-foreground">
						{event.source.repository
							? `${event.source.repository}#${event.source.number}`
							: `${prefix} #${event.source.number}`}
					</span>
					<span className="text-muted-foreground">{event.source.title}</span>
				</span>
			);
		}
		case "milestoned":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" added this to the "}
					<span className="font-medium text-foreground">
						{event.milestone?.title}
					</span>
					{" milestone"}
				</span>
			);
		case "demilestoned":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" removed this from the "}
					<span className="font-medium text-foreground">
						{event.milestone?.title}
					</span>
					{" milestone"}
				</span>
			);
		case "convert_to_draft":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" marked this as a draft"}
				</span>
			);
		case "ready_for_review":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" marked this as ready for review"}
				</span>
			);
		case "head_ref_deleted":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" deleted "}
					<code className="font-mono text-[11px] text-icon-faint">
						{headRefName}
					</code>
					{" branch"}
				</span>
			);
		case "head_ref_restored":
			return (
				<span className="inline-flex items-center gap-1 flex-wrap">
					<ActorMention actor={event.actor} hideAvatar />
					{" restored "}
					<code className="font-mono text-[11px] text-icon-faint">
						{headRefName}
					</code>
					{" branch"}
				</span>
			);
		default:
			return null;
	}
}
