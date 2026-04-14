import {
	CheckIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	CircleIcon,
	CommentIcon,
	Delete01Icon,
	EditIcon,
	GitBranchIcon,
	GitCommitIcon,
	GitMergeIcon,
	GitPullRequestIcon,
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
import { Markdown } from "@diffkit/ui/components/markdown";
import { MarkdownEditor } from "@diffkit/ui/components/markdown-editor";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { quickhubDark, quickhubLight } from "@diffkit/ui/lib/diffs-themes";
import { cn } from "@diffkit/ui/lib/utils";
import type { DiffLineAnnotation, PatchDiffProps } from "@pierre/diffs/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { CommentMoreMenu } from "#/components/details/comment-more-menu";
import {
	DetailActivityHeader,
	DetailCommentBox,
} from "#/components/details/detail-activity";
import { LabelPill } from "#/components/details/label-pill";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	deleteBranch,
	dismissPullReview,
	getCommentPage,
	getTimelineEventPage,
	mergePullRequest,
	replyToReviewComment,
	requestPullReviewers,
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
	PullCheckRun,
	PullComment,
	PullCommit,
	PullDetail,
	PullPageData,
	PullReviewComment,
	PullStatus,
	TimelineEvent,
} from "#/lib/github.types";
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
}: {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const statusQuery = useQuery({
		...githubPullStatusQueryOptions(scope, { owner, repo, pullNumber }),
	});

	const status = statusQuery.data ?? null;

	if (!status) return <MergeStatusSkeleton />;

	return (
		<MergeStatusCard
			status={status}
			owner={owner}
			repo={repo}
			pullNumber={pullNumber}
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
	const [isDeleting, setIsDeleting] = useState(false);
	const [isDeleted, setIsDeleted] = useState(false);

	const deleted = headRefDeleted || isDeleted;

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const result = await deleteBranch({
				data: { owner, repo, branch: branchName, pullNumber },
			});
			if (result.ok) {
				setIsDeleted(true);
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
				setIsDeleting(false);
			}
		} catch {
			toast.error("Failed to delete branch");
			setIsDeleting(false);
		}
	};

	return (
		<div className="flex items-center gap-3 rounded-lg bg-purple-500/15 px-4 py-3">
			<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
				<GitMergeIcon size={12} strokeWidth={2} />
			</div>
			<p className="flex-1 text-sm text-purple-900 dark:text-purple-200">
				{deleted ? (
					<>
						Branch{" "}
						<code className="rounded bg-purple-500/20 px-1 py-0.5 font-mono text-xs">
							{branchName}
						</code>{" "}
						has been deleted.
					</>
				) : (
					<>
						Branch{" "}
						<code className="rounded bg-purple-500/20 px-1 py-0.5 font-mono text-xs">
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
					className="shrink-0 text-purple-700 hover:bg-purple-500/10 hover:text-purple-800 dark:text-purple-300 dark:hover:bg-purple-500/10 dark:hover:text-purple-200"
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
	status,
	owner,
	repo,
	pullNumber,
}: {
	status: PullStatus;
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const {
		checks,
		checkRuns,
		reviews,
		mergeable,
		mergeableState,
		behindBy,
		baseRefName,
		canUpdateBranch,
		canBypassProtections,
	} = status;

	const approvedReviews = reviews.filter((r) => r.state === "APPROVED");
	const changesRequested = reviews.filter(
		(r) => r.state === "CHANGES_REQUESTED",
	);

	const hasReviewIssue = changesRequested.length > 0;
	const allChecksPassed =
		checks.total > 0 && checks.failed === 0 && checks.pending === 0;
	const hasCheckFailures = checks.failed > 0;
	const isBehind = behindBy !== null && behindBy > 0;
	const hasConflicts = mergeableState === "dirty";
	const isMergeBlocked = mergeableState === "blocked" || mergeable === false;

	return (
		<div className="flex flex-col overflow-hidden rounded-lg border">
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
			{checks.total > 0 && (
				<ChecksSection
					checks={checks}
					checkRuns={checkRuns}
					allChecksPassed={allChecksPassed}
					hasCheckFailures={hasCheckFailures}
				/>
			)}

			{/* Conflicts / branch status */}
			{hasConflicts ? (
				<StatusRow
					icon={<StatusIcon status="error" />}
					title="This branch has conflicts that must be resolved"
					description="Use the command line to resolve conflicts."
				/>
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

			{/* Merge action footer */}
			<MergeFooter
				isMergeBlocked={isMergeBlocked}
				canBypassProtections={canBypassProtections}
				owner={owner}
				repo={repo}
				pullNumber={pullNumber}
			/>
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
					className="flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-surface-1/50"
				>
					<div className="mt-0.5 shrink-0">
						<StatusIcon status={reviewStatus} />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="text-sm font-medium">{title}</p>
						<p className="text-xs text-muted-foreground">{description}</p>
					</div>
					<div className="mt-0.5 shrink-0 text-muted-foreground">
						{open ? (
							<ChevronUpIcon size={16} strokeWidth={2} />
						) : (
							<ChevronDownIcon size={16} strokeWidth={2} />
						)}
					</div>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				{allReviews.length > 0 && (
					<div className="flex flex-col border-b border-border/50 bg-surface-1/50 py-1">
						{allReviews.map((review) => (
							<div
								key={review.id}
								className="flex items-center gap-2 px-4 py-1.5 pl-11"
							>
								<CheckRunIcon
									status={review.state === "APPROVED" ? "success" : "failure"}
								/>
								{review.author && (
									<img
										src={review.author.avatarUrl}
										alt={review.author.login}
										className="size-4 rounded-full border border-border"
									/>
								)}
								<span className="text-xs">
									{review.author?.login ?? "Unknown"}
								</span>
								<span
									className={cn(
										"ml-auto text-xs",
										review.state === "APPROVED"
											? "text-green-600 dark:text-green-400"
											: "text-red-600 dark:text-red-400",
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
											className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
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
															void queryClient.invalidateQueries({
																queryKey: ["github"],
															});
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
																void queryClient.invalidateQueries({
																	queryKey: ["github"],
																});
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
	checks,
	checkRuns,
	allChecksPassed,
	hasCheckFailures,
}: {
	checks: PullStatus["checks"];
	checkRuns: PullCheckRun[];
	allChecksPassed: boolean;
	hasCheckFailures: boolean;
}) {
	const [open, setOpen] = useState(true);

	const checkStatus: StatusType = allChecksPassed
		? "success"
		: hasCheckFailures
			? "error"
			: "pending";

	const title = allChecksPassed
		? "All checks have passed"
		: hasCheckFailures
			? `${checks.failed} failing check${checks.failed > 1 ? "s" : ""}`
			: `${checks.pending} pending check${checks.pending > 1 ? "s" : ""}`;

	const parts: string[] = [];
	if (checks.skipped > 0) parts.push(`${checks.skipped} skipped`);
	parts.push(
		`${checks.passed} successful check${checks.passed !== 1 ? "s" : ""}`,
	);
	if (checks.pending > 0) parts.push(`${checks.pending} pending`);
	if (checks.failed > 0) parts.push(`${checks.failed} failing`);
	const description = parts.join(", ");

	// Sort: failed first, then pending, then skipped, then passed
	const sortedRuns = [...checkRuns].sort((a, b) => {
		const order = (run: PullCheckRun) => {
			if (run.status !== "completed") return 1;
			if (
				run.conclusion === "failure" ||
				run.conclusion === "timed_out" ||
				run.conclusion === "cancelled"
			)
				return 0;
			if (run.conclusion === "skipped") return 2;
			return 3;
		};
		return order(a) - order(b);
	});

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-surface-1/50"
				>
					<div className="mt-0.5 shrink-0">
						<StatusIcon status={checkStatus} />
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="text-sm font-medium">{title}</p>
						<p className="text-xs text-muted-foreground">{description}</p>
					</div>
					<div className="mt-0.5 shrink-0 text-muted-foreground">
						{open ? (
							<ChevronUpIcon size={16} strokeWidth={2} />
						) : (
							<ChevronDownIcon size={16} strokeWidth={2} />
						)}
					</div>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="flex max-h-64 flex-col overflow-y-auto border-b border-border/50 bg-surface-1/50 py-1">
					{sortedRuns.map((run) => {
						const runStatus = getCheckRunStatus(run);
						return (
							<div
								key={run.id}
								className="flex items-center gap-2 px-4 py-1.5 pl-11"
							>
								<CheckRunIcon status={runStatus} />
								{run.appAvatarUrl && (
									<img
										src={run.appAvatarUrl}
										alt=""
										className="size-4 shrink-0 rounded border border-border"
									/>
								)}
								<span className="min-w-0 flex-1 truncate text-xs">
									{run.name}
									<span className="text-muted-foreground">
										{runStatus === "pending" && run.startedAt
											? ` — Started ${formatRelativeTime(run.startedAt)}`
											: run.outputTitle
												? ` — ${run.outputTitle}`
												: null}
									</span>
								</span>
								<span
									className={cn(
										"shrink-0 text-xs capitalize",
										runStatus === "success" &&
											"text-green-600 dark:text-green-400",
										runStatus === "failure" && "text-red-600 dark:text-red-400",
										runStatus === "pending" &&
											"text-yellow-600 dark:text-yellow-400",
										runStatus === "skipped" && "text-muted-foreground",
									)}
								>
									{runStatus === "success"
										? "Passed"
										: runStatus === "failure"
											? "Failed"
											: runStatus === "pending"
												? "Pending"
												: "Skipped"}
								</span>
							</div>
						);
					})}
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
				await queryClient.invalidateQueries({ queryKey: ["github"] });
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
		<div className="flex overflow-hidden rounded-md">
			<Button
				variant="secondary"
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
						variant="secondary"
						size="xs"
						disabled={isUpdating}
						className="rounded-l-none border-l border-l-secondary-foreground/10 px-1"
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

// ── Merge footer ────────────────────────────────────────────────────

const MERGE_STRATEGIES = [
	{ value: "merge" as const, label: "Create a merge commit" },
	{ value: "squash" as const, label: "Squash and merge" },
	{ value: "rebase" as const, label: "Rebase and merge" },
];

function MergeFooter({
	isMergeBlocked,
	canBypassProtections,
	owner,
	repo,
	pullNumber,
}: {
	isMergeBlocked: boolean;
	canBypassProtections: boolean;
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const [mergeMethod, setMergeMethod] = useState<"merge" | "squash" | "rebase">(
		"squash",
	);
	const [isMerging, setIsMerging] = useState(false);
	const [bypassChecks, setBypassChecks] = useState(false);
	const queryClient = useQueryClient();

	const currentStrategy =
		MERGE_STRATEGIES.find((s) => s.value === mergeMethod) ??
		MERGE_STRATEGIES[0];

	const handleMerge = async () => {
		setIsMerging(true);
		try {
			const result = await mergePullRequest({
				data: {
					owner,
					repo,
					pullNumber,
					mergeMethod,
					bypassProtections: bypassChecks,
				},
			});
			if (result.ok) {
				await queryClient.invalidateQueries({ queryKey: ["github"] });
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
				setIsMerging(false);
			}
		} catch {
			toast.error("Failed to merge pull request");
			setIsMerging(false);
		}
	};

	const isDisabled = (isMergeBlocked && !bypassChecks) || isMerging;

	return (
		<div className="flex flex-col gap-3 px-4 py-3">
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2">
					<div className="flex overflow-hidden rounded-md">
						<Button
							size="sm"
							disabled={isDisabled}
							onClick={() => {
								void handleMerge();
							}}
							className="rounded-r-none"
							iconLeft={
								isMerging ? (
									<Spinner size={14} />
								) : (
									<GitMergeIcon size={14} strokeWidth={2} />
								)
							}
						>
							{currentStrategy.label}
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									size="sm"
									disabled={isDisabled}
									className="rounded-l-none border-l border-primary-foreground/20 px-1.5"
								>
									<ChevronDownIcon size={14} strokeWidth={2} />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{MERGE_STRATEGIES.map((strategy) => (
									<DropdownMenuItem
										key={strategy.value}
										onClick={() => setMergeMethod(strategy.value)}
									>
										<span className="flex items-center gap-2">
											{strategy.value === mergeMethod && (
												<CheckIcon size={14} strokeWidth={2} />
											)}
											<span
												className={cn(strategy.value !== mergeMethod && "pl-5")}
											>
												{strategy.label}
											</span>
										</span>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				{isMergeBlocked && !bypassChecks && (
					<p className="text-xs text-muted-foreground">
						Merging is blocked — all required conditions have not been met.
					</p>
				)}
			</div>
			{isMergeBlocked && canBypassProtections && (
				<div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-500">
					<Checkbox
						id="bypass-checks"
						checked={bypassChecks}
						onCheckedChange={(checked) => setBypassChecks(checked === true)}
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
		<div className="flex items-start gap-3 border-b border-border/50 px-4 py-3">
			<div className="mt-0.5 shrink-0">{icon}</div>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-sm font-medium">{title}</p>
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
			<div className="flex size-4 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500">
				<CheckIcon size={10} strokeWidth={3} />
			</div>
		);
	}
	if (status === "error") {
		return (
			<div className="flex size-4 items-center justify-center rounded-full bg-red-600 text-white dark:bg-red-500">
				<XIcon size={10} strokeWidth={3} />
			</div>
		);
	}
	return (
		<div className="flex size-4 items-center justify-center rounded-full border-2 border-yellow-500 text-yellow-500">
			<div className="size-1.5 rounded-full bg-current" />
		</div>
	);
}

function CheckRunIcon({
	status,
}: {
	status: "success" | "failure" | "pending" | "skipped";
}) {
	if (status === "success") {
		return (
			<div className="flex size-3.5 shrink-0 items-center justify-center text-green-600 dark:text-green-400">
				<CheckIcon size={12} strokeWidth={3} />
			</div>
		);
	}
	if (status === "failure") {
		return (
			<div className="flex size-3.5 shrink-0 items-center justify-center text-red-600 dark:text-red-400">
				<XIcon size={12} strokeWidth={3} />
			</div>
		);
	}
	if (status === "skipped") {
		return (
			<div className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
				<div className="size-1.5 rounded-full border border-current" />
			</div>
		);
	}
	return (
		<div className="flex size-3.5 shrink-0 items-center justify-center text-yellow-500">
			<svg
				className="size-3.5 animate-spin"
				viewBox="0 0 16 16"
				fill="none"
				aria-hidden="true"
			>
				<circle
					cx="8"
					cy="8"
					r="6"
					stroke="currentColor"
					strokeWidth="2"
					opacity="0.25"
				/>
				<path
					d="M14 8a6 6 0 0 0-6-6"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
				/>
			</svg>
		</div>
	);
}

function getCheckRunStatus(
	run: PullCheckRun,
): "success" | "failure" | "pending" | "skipped" {
	if (run.status !== "completed") return "pending";
	if (run.conclusion === "success" || run.conclusion === "neutral")
		return "success";
	if (run.conclusion === "skipped") return "skipped";
	return "failure";
}

function MergeStatusSkeleton() {
	return (
		<div className="flex flex-col rounded-lg border">
			{[0, 1, 2].map((item) => (
				<div
					key={item}
					className={cn(
						"flex items-start gap-3 px-4 py-3",
						item < 2 && "border-b border-border/50",
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
	const allItems: TimelineItem[] = [
		...comments.map((comment) => ({
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
	].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
		<div className="relative flex flex-col md:pl-8 md:before:absolute md:before:left-4 md:before:top-0 md:before:h-full md:before:w-px md:before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
			{visibleItems.map((item, index) => {
				const previousType = index > 0 ? visibleItems[index - 1].type : null;
				const nextType =
					index < visibleItems.length - 1 ? visibleItems[index + 1].type : null;
				const isConsecutiveCommit =
					item.type === "commit" && previousType === "commit";
				const isLastInCommitRun =
					item.type === "commit" && nextType !== "commit";
				const isConsecutiveEvent =
					item.type === "event" && previousType === "event";
				const isLastInEventRun = item.type === "event" && nextType !== "event";

				const row = (() => {
					if (item.type === "comment") {
						const comment = item.data;
						return (
							<div
								key={`comment-${comment.id}`}
								className={cn(
									"group/comment relative flex flex-col gap-1 py-5",
									index === 0 && "pt-5",
								)}
							>
								<div className="flex items-center gap-1.5">
									{comment.author ? (
										<img
											src={comment.author.avatarUrl}
											alt={comment.author.login}
											className="size-4 rounded-full border border-border"
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
									<div className="ml-auto">
										<CommentMoreMenu
											commentId={comment.id}
											body={comment.body}
											owner={owner}
											repo={repo}
											number={pullNumber}
											commentType="issue"
											isAuthor={
												viewerLogin != null &&
												comment.author?.login === viewerLogin
											}
										/>
									</div>
								</div>
								<Markdown className="text-muted-foreground">
									{comment.body}
								</Markdown>
							</div>
						);
					}

					if (item.type === "commit") {
						const commit = item.data;
						const firstLine = commit.message.split("\n")[0];
						return (
							<div
								key={`commit-${commit.sha}`}
								className={cn(
									"flex items-center gap-1.5",
									index === 0 ? "pt-5" : isConsecutiveCommit ? "pt-2" : "pt-5",
									isLastInCommitRun ? "pb-5" : "pb-2",
								)}
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
								<span className="min-w-0 truncate text-[13px]">
									{firstLine}
								</span>
								<code className="ml-auto shrink-0 rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
									{commit.sha.slice(0, 7)}
								</code>
								<span className="shrink-0 text-[13px] text-muted-foreground">
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
								<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-purple-500 text-white">
									<GitMergeIcon size={12} strokeWidth={2} />
								</div>
								{mergedPr.mergedBy ? (
									<img
										src={mergedPr.mergedBy.avatarUrl}
										alt={mergedPr.mergedBy.login}
										className="size-5 shrink-0 rounded-full border border-border"
									/>
								) : (
									<div className="size-5 shrink-0 rounded-full bg-surface-2" />
								)}
								<span className="text-[13px]">
									<span className="font-medium">
										{mergedPr.mergedBy?.login ?? "Unknown"}
									</span>
									{" merged commit "}
									{mergedPr.mergeCommitSha && (
										<code className="rounded bg-surface-1 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
											{mergedPr.mergeCommitSha.slice(0, 7)}
										</code>
									)}
									{" into "}
									<code className="rounded bg-surface-1 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
										{mergedPr.baseRefName}
									</code>
								</span>
								<span className="ml-auto shrink-0 text-[13px] text-muted-foreground">
									{formatRelativeTime(mergedPr.mergedAt as string)}
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
					"flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1 text-xs text-muted-foreground transition-colors",
					isPending
						? "cursor-not-allowed opacity-60"
						: "hover:bg-surface-2 hover:text-foreground",
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
					<span className="min-w-0 text-[13px] text-muted-foreground">
						{description}
					</span>
					{event.createdAt && (
						<span className="ml-auto shrink-0 text-[13px] text-muted-foreground">
							{formatRelativeTime(event.createdAt)}
						</span>
					)}
				</div>
				{hasReviewBody && (
					<Markdown className="text-muted-foreground">
						{event.body as string}
					</Markdown>
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
				"flex items-center gap-1.5",
				isFirst ? "pt-5" : isConsecutive ? "pt-2" : "pt-5",
				isLastInRun ? "pb-5" : "pb-2",
			)}
		>
			{hasActorAvatar ? (
				<img
					src={event.actor?.avatarUrl}
					alt={event.actor?.login}
					className="size-5 shrink-0 rounded-full border border-border"
				/>
			) : (
				<div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-1">
					{icon}
				</div>
			)}
			<span className="min-w-0 text-[13px] text-muted-foreground">
				{description}
			</span>
			{event.createdAt && (
				<span className="ml-auto shrink-0 text-[13px] text-muted-foreground">
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
	return (
		<div className="group/comment relative px-3 py-2.5">
			<div className="mb-1.5 flex items-center gap-1.5">
				{comment.author ? (
					<img
						src={comment.author.avatarUrl}
						alt={comment.author.login}
						className="size-4 rounded-full border border-border"
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
				{owner && repo && pullNumber != null && (
					<div className="ml-auto">
						<CommentMoreMenu
							commentId={comment.id}
							body={comment.body}
							owner={owner}
							repo={repo}
							number={pullNumber}
							commentType="review"
							isAuthor={
								viewerLogin != null && comment.author?.login === viewerLogin
							}
						/>
					</div>
				)}
			</div>
			<Markdown className="text-muted-foreground">{comment.body}</Markdown>
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
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [replyBody, setReplyBody] = useState("");
	const [isSending, setIsSending] = useState(false);
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
		setIsSending(true);
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
				setShowReplyForm(false);
				void queryClient.invalidateQueries({
					queryKey: githubQueryKeys.all,
				});
			} else {
				toast.error("Failed to send reply");
			}
		} catch {
			toast.error("Failed to send reply");
		} finally {
			setIsSending(false);
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
				void queryClient.invalidateQueries({ queryKey: githubQueryKeys.all });
			} else {
				toast.error(result.error);
			}
		} catch {
			toast.error("Failed to update thread");
		} finally {
			setIsResolving(false);
		}
	}, [threadInfo, owner, repo, queryClient]);

	const canReply = owner && repo && pullNumber != null;

	const renderAnnotation = useCallback(
		(annotation: DiffLineAnnotation<PullReviewComment>) => {
			const data = annotation.metadata;
			if (!data) return null;
			return (
				<div className="m-2 divide-y rounded-lg border bg-surface-0">
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
											setShowReplyForm(false);
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
										className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-50"
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
										onClick={() => setShowReplyForm(true)}
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
		<div className="overflow-hidden rounded-lg border">
			<div className="flex items-center gap-1.5 bg-surface-1 px-3 py-2 text-[13px] text-muted-foreground">
				{threadInfo?.isResolved && (
					<span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
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
		case "reviewed":
			return (
				<ReviewsIcon
					size={12}
					strokeWidth={2}
					className={cn(
						event.reviewState === "approved"
							? "text-green-600 dark:text-green-400"
							: event.reviewState === "changes_requested"
								? "text-red-600 dark:text-red-400"
								: "text-muted-foreground",
					)}
				/>
			);
		case "renamed":
			return (
				<EditIcon size={12} strokeWidth={2} className="text-muted-foreground" />
			);
		case "closed":
			return (
				<GitMergeIcon size={12} strokeWidth={2} className="text-purple-500" />
			);
		case "reopened":
			return (
				<GitPullRequestIcon
					size={12}
					strokeWidth={2}
					className="text-green-600 dark:text-green-400"
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
					className="text-green-600 dark:text-green-400"
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
					className="inline-block size-3.5 rounded-full border border-border align-text-bottom"
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
				<span className="flex items-center gap-1.5">
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
				<span className="flex items-center gap-1.5">
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
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" assigned "}
					<ActorMention actor={event.assignee} />
				</span>
			);
		case "unassigned":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" unassigned "}
					<ActorMention actor={event.assignee} />
				</span>
			);
		case "review_requested":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" requested review from "}
					<ActorMention actor={reviewer} />
				</span>
			);
		case "review_request_removed":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" removed review request for "}
					<ActorMention actor={reviewer} />
				</span>
			);
		case "reviewed": {
			const state = event.reviewState?.toLowerCase();
			const stateLabel =
				state === "approved"
					? "approved"
					: state === "changes_requested"
						? "requested changes"
						: "reviewed";
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{` ${stateLabel}`}
				</span>
			);
		}
		case "renamed":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" changed the title from "}
					<span className="line-through">{event.rename?.from}</span>
					{" to "}
					<span className="font-medium text-foreground">
						{event.rename?.to}
					</span>
				</span>
			);
		case "closed":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" closed this"}
				</span>
			);
		case "reopened":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" reopened this"}
				</span>
			);
		case "cross-referenced":
		case "referenced": {
			if (!event.source) return null;
			const prefix = event.source.type === "pull_request" ? "PR" : "Issue";
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
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
				<span className="inline-flex items-center gap-1">
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
				<span className="inline-flex items-center gap-1">
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
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" deleted "}
					<code className="rounded bg-surface-1 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
						{headRefName}
					</code>
					{" branch"}
				</span>
			);
		case "head_ref_restored":
			return (
				<span className="inline-flex items-center gap-1">
					<ActorMention actor={event.actor} hideAvatar />
					{" restored "}
					<code className="rounded bg-surface-1 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
						{headRefName}
					</code>
					{" branch"}
				</span>
			);
		default:
			return null;
	}
}
