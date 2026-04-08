import {
	GitBranchIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@quickhub/icons";
import { Markdown } from "@quickhub/ui/components/markdown";
import { Skeleton } from "@quickhub/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@quickhub/ui/components/tooltip";
import { cn } from "@quickhub/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatRelativeTime } from "#/components/pulls/pull-request-row";
import { updatePullBranch } from "#/lib/github.functions";
import {
	githubPullPageQueryOptions,
	githubPullStatusQueryOptions,
} from "#/lib/github.query";
import type { GitHubActor, PullDetail, PullStatus } from "#/lib/github.types";
import { githubCachePolicy } from "#/lib/github-cache-policy";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useRegisterTab } from "#/lib/use-register-tab";

export const Route = createFileRoute("/_protected/$owner/$repo/pull/$pullId")({
	loader: async ({ context, params }) => {
		const pullNumber = Number(params.pullId);
		const scope = { userId: context.user.id };
		const pageOptions = githubPullPageQueryOptions(scope, {
			owner: params.owner,
			repo: params.repo,
			pullNumber,
		});

		const primeQuery = (options: { queryKey: readonly unknown[] }) => {
			if (context.queryClient.getQueryData(options.queryKey) !== undefined) {
				return Promise.resolve();
			}

			return context.queryClient.ensureQueryData(options);
		};

		await Promise.all([primeQuery(pageOptions)]);
	},
	component: PullDetailPage,
});

function getPrStateConfig(pr: PullDetail) {
	if (pr.isDraft) {
		return {
			icon: GitPullRequestDraftIcon,
			color: "text-muted-foreground",
			label: "Draft",
			badgeClass: "bg-muted text-muted-foreground",
		};
	}
	if (pr.isMerged || pr.mergedAt) {
		return {
			icon: GitMergeIcon,
			color: "text-purple-500",
			label: "Merged",
			badgeClass: "bg-purple-500/10 text-purple-500",
		};
	}
	if (pr.state === "closed") {
		return {
			icon: GitPullRequestClosedIcon,
			color: "text-red-500",
			label: "Closed",
			badgeClass: "bg-red-500/10 text-red-500",
		};
	}
	return {
		icon: GitPullRequestIcon,
		color: "text-green-500",
		label: "Open",
		badgeClass: "bg-green-500/10 text-green-500",
	};
}

function PullDetailPage() {
	const { user } = Route.useRouteContext();
	const { owner, repo, pullId } = Route.useParams();
	const pullNumber = Number(pullId);
	const scope = { userId: user.id };
	const hasMounted = useHasMounted();

	const pageQuery = useQuery({
		...githubPullPageQueryOptions(scope, { owner, repo, pullNumber }),
		enabled: hasMounted,
	});

	const statusQuery = useQuery({
		...githubPullStatusQueryOptions(scope, { owner, repo, pullNumber }),
		enabled: hasMounted && pageQuery.data?.detail != null,
		refetchOnWindowFocus: "always",
		refetchInterval: githubCachePolicy.status.staleTimeMs,
	});

	const pr = pageQuery.data?.detail;
	const comments = pageQuery.data?.comments;
	const status = statusQuery.data ?? null;

	useRegisterTab(
		pr
			? {
					type: "pull",
					title: pr.title,
					number: pr.number,
					url: `/${owner}/${repo}/pull/${pullId}`,
					repo: `${owner}/${repo}`,
					iconColor: getPrStateConfig(pr).color,
				}
			: null,
	);

	if (pageQuery.error) throw pageQuery.error;
	if (!pr) return <PullDetailPageSkeleton />;

	const stateConfig = getPrStateConfig(pr);
	const StateIcon = stateConfig.icon;

	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-16 px-6 py-10 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				{/* Left: PR content */}
				<div className="flex min-w-0 flex-col gap-8">
					{/* Header */}
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Link
								to="/pulls"
								className="transition-colors hover:text-foreground"
							>
								Pull Requests
							</Link>
							<span>/</span>
							<span>
								{owner}/{repo}
							</span>
							<span>/</span>
							<span>#{pr.number}</span>
						</div>

						<div className="flex items-start gap-3">
							<div className={cn("mt-1 shrink-0", stateConfig.color)}>
								<StateIcon size={20} strokeWidth={2} />
							</div>
							<div className="flex min-w-0 flex-col gap-2">
								<h1 className="text-xl font-semibold tracking-tight">
									{pr.title}
								</h1>
								<div className="flex flex-wrap items-center gap-2">
									<span
										className={cn(
											"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
											stateConfig.badgeClass,
										)}
									>
										{stateConfig.label}
									</span>
									{pr.author && (
										<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
											<img
												src={pr.author.avatarUrl}
												alt={pr.author.login}
												className="size-4 rounded-full border border-border"
											/>
											<span className="font-medium text-foreground">
												{pr.author.login}
											</span>
											<span>
												wants to merge into{" "}
												<code className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-xs">
													{pr.baseRefName}
												</code>{" "}
												from{" "}
												<code className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-xs">
													{pr.headRefName}
												</code>
											</span>
										</span>
									)}
								</div>
							</div>
						</div>
					</div>

					{/* Stats bar */}
					<div className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-2.5 text-xs text-muted-foreground">
						<span className="flex items-center gap-1.5">
							<GitBranchIcon size={13} strokeWidth={2} />
							<span className="tabular-nums font-medium text-foreground">
								{pr.commits}
							</span>{" "}
							{pr.commits === 1 ? "commit" : "commits"}
						</span>
						<span className="text-border">·</span>
						<span>
							<span className="tabular-nums font-medium text-foreground">
								{pr.changedFiles}
							</span>{" "}
							{pr.changedFiles === 1 ? "file" : "files"} changed
						</span>
						<span className="text-border">·</span>
						<span className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.5">
							<span className="tabular-nums font-medium text-green-500">
								+{pr.additions}
							</span>
							<span className="tabular-nums font-medium text-red-500">
								-{pr.deletions}
							</span>
						</span>
					</div>

					{/* Labels */}
					{pr.labels.length > 0 && (
						<div className="flex flex-wrap items-center gap-1.5">
							{pr.labels.map((label) => (
								<span
									key={label.name}
									className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
									style={{
										borderColor: `#${label.color}40`,
										backgroundColor: `#${label.color}15`,
										color: `#${label.color}`,
									}}
								>
									{label.name}
								</span>
							))}
						</div>
					)}

					{/* Body */}
					{pr.body ? (
						<div className="rounded-lg border bg-surface-0 p-5">
							<Markdown>{pr.body}</Markdown>
						</div>
					) : (
						<div className="rounded-lg border bg-surface-0 p-5">
							<p className="text-sm text-muted-foreground italic">
								No description provided.
							</p>
						</div>
					)}

					{/* Activity / Comments */}
					<div className="flex flex-col">
						<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
							<h2 className="text-xs font-medium">Activity</h2>
							{comments && (
								<span className="text-xs tabular-nums text-muted-foreground">
									{comments.length}
								</span>
							)}
						</div>

						{pageQuery.isFetching && !comments && (
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

						{comments && comments.length === 0 && (
							<p className="py-4 text-sm text-muted-foreground">
								No comments yet.
							</p>
						)}

						{comments && comments.length > 0 && (
							<div className="relative flex flex-col pl-8 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
								{comments.map((comment, i) => (
									<div
										key={comment.id}
										className={cn(
											"flex flex-col gap-1 py-4",
											i === 0 && "pt-5",
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
											<span className="text-xs font-medium">
												{comment.author?.login ?? "Unknown"}
											</span>
											<span className="text-xs text-muted-foreground">
												{formatRelativeTime(comment.createdAt)}
											</span>
										</div>
										<Markdown className="text-muted-foreground">
											{comment.body}
										</Markdown>
									</div>
								))}
							</div>
						)}

						{/* Status card */}
						{!pr.isMerged && pr.state !== "closed" && (
							<div className="mt-6">
								{status ? (
									<MergeStatusCard
										status={status}
										owner={owner}
										repo={repo}
										pullNumber={pullNumber}
									/>
								) : (
									<MergeStatusSkeleton />
								)}
							</div>
						)}

						{/* Comment input */}
						<div className="mt-6">
							<CommentBox />
						</div>
					</div>
				</div>

				{/* Right sidebar: Metadata */}
				<aside className="flex h-fit flex-col gap-6 xl:sticky xl:top-10">
					{/* Reviewers */}
					<SidebarSection title="Reviewers">
						{pr.requestedReviewers.length > 0 ? (
							<div className="flex flex-col gap-2">
								{pr.requestedReviewers.map((reviewer) => (
									<ActorRow key={reviewer.login} actor={reviewer} />
								))}
							</div>
						) : (
							<p className="text-xs text-muted-foreground">
								No reviewers requested
							</p>
						)}
					</SidebarSection>

					{/* Participants */}
					<SidebarSection title="Participants">
						<ParticipantsList pr={pr} comments={comments ?? []} />
					</SidebarSection>

					{/* Details */}
					<SidebarSection title="Details">
						<div className="flex flex-col gap-2 text-xs">
							<DetailRow label="Created">
								{formatRelativeTime(pr.createdAt)}
							</DetailRow>
							<DetailRow label="Updated">
								{formatRelativeTime(pr.updatedAt)}
							</DetailRow>
							{pr.mergedAt && (
								<DetailRow label="Merged">
									{formatRelativeTime(pr.mergedAt)}
								</DetailRow>
							)}
							{pr.closedAt && !pr.mergedAt && (
								<DetailRow label="Closed">
									{formatRelativeTime(pr.closedAt)}
								</DetailRow>
							)}
							<DetailRow label="Comments">
								<span className="tabular-nums">{pr.comments}</span>
							</DetailRow>
							<DetailRow label="Review comments">
								<span className="tabular-nums">{pr.reviewComments}</span>
							</DetailRow>
						</div>
					</SidebarSection>
				</aside>
			</div>
		</div>
	);
}

function SidebarSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2.5">
			<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				{title}
			</h3>
			{children}
		</div>
	);
}

function ActorRow({ actor }: { actor: GitHubActor }) {
	return (
		<div className="flex items-center gap-2">
			<img
				src={actor.avatarUrl}
				alt={actor.login}
				className="size-5 rounded-full border border-border"
			/>
			<span className="text-sm">{actor.login}</span>
		</div>
	);
}

function DetailRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="text-muted-foreground">{label}</span>
			<span className="text-foreground">{children}</span>
		</div>
	);
}

function ParticipantsList({
	pr,
	comments,
}: {
	pr: PullDetail;
	comments: Array<{ author: GitHubActor | null }>;
}) {
	const seen = new Set<string>();
	const participants: GitHubActor[] = [];

	const addActor = (actor: GitHubActor | null) => {
		if (actor && !seen.has(actor.login)) {
			seen.add(actor.login);
			participants.push(actor);
		}
	};

	addActor(pr.author);
	for (const comment of comments) {
		addActor(comment.author);
	}

	if (participants.length === 0) {
		return <p className="text-xs text-muted-foreground">No participants yet</p>;
	}

	return (
		<div className="group/participants flex items-center">
			{participants.map((actor, i) => (
				<Tooltip key={actor.login}>
					<TooltipTrigger asChild>
						<img
							src={actor.avatarUrl}
							alt={actor.login}
							className="size-6 rounded-full border-2 border-card transition-[margin] duration-200 group-hover/participants:ml-0"
							style={i > 0 ? { marginLeft: -6 } : undefined}
						/>
					</TooltipTrigger>
					<TooltipContent>{actor.login}</TooltipContent>
				</Tooltip>
			))}
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
		reviews,
		mergeable,
		mergeableState,
		behindBy,
		baseRefName,
		canUpdateBranch,
	} = status;
	const [isUpdating, setIsUpdating] = useState(false);

	const approvedReviews = reviews.filter((r) => r.state === "APPROVED");
	const changesRequested = reviews.filter(
		(r) => r.state === "CHANGES_REQUESTED",
	);
	const pendingReviewers = reviews.filter((r) => r.state === "PENDING");

	const hasReviewIssue =
		changesRequested.length > 0 || pendingReviewers.length > 0;
	const allChecksPassed =
		checks.total > 0 && checks.failed === 0 && checks.pending === 0;
	const hasCheckFailures = checks.failed > 0;
	const hasChecksPending = checks.pending > 0;
	const isBehind = behindBy !== null && behindBy > 0;

	const isMergeBlocked = mergeableState === "blocked" || mergeable === false;

	return (
		<div className="flex flex-col rounded-lg border">
			{/* Reviews */}
			<StatusRow
				icon={
					changesRequested.length > 0 ? (
						<StatusDot color="text-red-500" />
					) : approvedReviews.length > 0 && !hasReviewIssue ? (
						<StatusDot color="text-green-500" />
					) : (
						<StatusDot color="text-yellow-500" />
					)
				}
				title={
					changesRequested.length > 0
						? "Changes requested"
						: approvedReviews.length > 0
							? `${approvedReviews.length} approving review${approvedReviews.length > 1 ? "s" : ""}`
							: "Review required"
				}
				description={
					changesRequested.length > 0
						? `${changesRequested.map((r) => r.author?.login).join(", ")} requested changes`
						: approvedReviews.length > 0 && !hasReviewIssue
							? "All required reviews have been provided"
							: "Code owner review required by reviewers with write access."
				}
			/>

			{/* Checks */}
			{checks.total > 0 && (
				<StatusRow
					icon={
						allChecksPassed ? (
							<StatusDot color="text-green-500" />
						) : hasCheckFailures ? (
							<StatusDot color="text-red-500" />
						) : (
							<StatusDot color="text-yellow-500" />
						)
					}
					title={
						allChecksPassed
							? "All checks have passed"
							: hasCheckFailures
								? `${checks.failed} failing check${checks.failed > 1 ? "s" : ""}`
								: `${checks.pending} pending check${checks.pending > 1 ? "s" : ""}`
					}
					description={
						`${checks.skipped > 0 ? `${checks.skipped} skipped, ` : ""}${checks.passed} successful check${checks.passed !== 1 ? "s" : ""}` +
						(hasChecksPending ? `, ${checks.pending} pending` : "") +
						(hasCheckFailures ? `, ${checks.failed} failing` : "")
					}
				/>
			)}

			{/* Behind base */}
			{isBehind && (
				<StatusRow
					icon={<StatusDot color="text-yellow-500" />}
					title="This branch is out-of-date with the base branch"
					description={`Merge the latest changes from ${baseRefName} into this branch.`}
					action={
						canUpdateBranch ? (
							<UpdateBranchButton
								owner={owner}
								repo={repo}
								pullNumber={pullNumber}
								isUpdating={isUpdating}
								setIsUpdating={setIsUpdating}
							/>
						) : undefined
					}
				/>
			)}

			{/* Merge status */}
			<StatusRow
				icon={
					isMergeBlocked ? (
						<StatusDot color="text-yellow-500" />
					) : (
						<StatusDot color="text-green-500" />
					)
				}
				title={isMergeBlocked ? "Merging is blocked" : "Ready to merge"}
				description={
					isMergeBlocked
						? "All required conditions have not been met."
						: "All required conditions have been satisfied."
				}
				isLast
			/>
		</div>
	);
}

function StatusRow({
	icon,
	title,
	description,
	action,
	isLast,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	action?: React.ReactNode;
	isLast?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-start gap-3 px-4 py-3",
				!isLast && "border-b border-border/50",
			)}
		>
			<div className="mt-0.5 shrink-0">{icon}</div>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			{action && <div className="shrink-0">{action}</div>}
		</div>
	);
}

function StatusDot({ color }: { color: string }) {
	return (
		<div className={cn("flex size-4 items-center justify-center", color)}>
			<div className="size-2 rounded-full bg-current" />
		</div>
	);
}

function MergeStatusSkeleton() {
	return (
		<div className="flex flex-col rounded-lg border">
			{[0, 1, 2].map((i) => (
				<div
					key={i}
					className={cn(
						"flex items-start gap-3 px-4 py-3",
						i < 2 && "border-b border-border/50",
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

function PullDetailPageSkeleton() {
	return (
		<div className="h-full overflow-auto">
			<div className="mx-auto grid max-w-7xl gap-16 px-6 py-10 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
				<div className="flex min-w-0 flex-col gap-8">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-3 w-32" />
						<div className="flex items-start gap-3">
							<Skeleton className="mt-1 size-5 rounded-full" />
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<Skeleton className="h-7 w-3/5" />
								<div className="flex flex-wrap items-center gap-2">
									<Skeleton className="h-5 w-14 rounded-full" />
									<Skeleton className="h-4 w-64" />
								</div>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-2.5">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-24" />
					</div>

					<div className="rounded-lg border bg-surface-0 p-5">
						<div className="flex flex-col gap-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-5/6" />
							<Skeleton className="h-4 w-2/3" />
							<Skeleton className="h-4 w-3/4" />
						</div>
					</div>

					<div className="flex flex-col gap-6">
						<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-6" />
						</div>
						<div className="flex flex-col gap-4 pl-8">
							{[0, 1, 2].map((item) => (
								<div key={item} className="flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<Skeleton className="size-4 rounded-full" />
										<Skeleton className="h-3.5 w-24" />
										<Skeleton className="h-3.5 w-16" />
									</div>
									<Skeleton className="h-4 w-5/6" />
									<Skeleton className="h-4 w-2/3" />
								</div>
							))}
						</div>
						<MergeStatusSkeleton />
					</div>
				</div>

				<aside className="flex h-fit flex-col gap-6 xl:sticky xl:top-10">
					{[0, 1, 2].map((section) => (
						<div key={section} className="flex flex-col gap-2.5">
							<Skeleton className="h-3 w-20" />
							<div className="flex flex-col gap-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-5/6" />
								<Skeleton className="h-4 w-2/3" />
							</div>
						</div>
					))}
				</aside>
			</div>
		</div>
	);
}

function UpdateBranchButton({
	owner,
	repo,
	pullNumber,
	isUpdating,
	setIsUpdating,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	isUpdating: boolean;
	setIsUpdating: (v: boolean) => void;
}) {
	const queryClient = useQueryClient();

	const handleUpdate = async () => {
		setIsUpdating(true);
		try {
			const success = await updatePullBranch({
				data: { owner, repo, pullNumber },
			});
			if (success) {
				await queryClient.invalidateQueries({
					queryKey: ["github"],
				});
			}
		} finally {
			setIsUpdating(false);
		}
	};

	return (
		<button
			type="button"
			disabled={isUpdating}
			onClick={handleUpdate}
			className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground disabled:opacity-50"
		>
			{isUpdating ? "Updating…" : "Update branch"}
		</button>
	);
}

function CommentBox() {
	const [value, setValue] = useState("");

	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-surface-0 p-3">
			<textarea
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Leave a comment..."
				rows={3}
				className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			/>
			<div className="flex justify-end">
				<button
					type="button"
					disabled={!value.trim()}
					className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-40"
				>
					Send
				</button>
			</div>
		</div>
	);
}
