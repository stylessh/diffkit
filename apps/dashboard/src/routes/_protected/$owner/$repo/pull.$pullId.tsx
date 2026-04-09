import {
	CalendarIcon,
	CheckIcon,
	ClockIcon,
	CloseIcon,
	CommentIcon,
	CopyIcon,
	EditIcon,
	FileIcon,
	GitCommitIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	MessageIcon,
	MoreHorizontalIcon,
	PlusSignIcon,
	ReviewsIcon,
	SearchIcon,
} from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { highlightCode, Markdown } from "@diffkit/ui/components/markdown";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { Spinner } from "@diffkit/ui/components/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LabelsSection } from "#/components/labels-section";
import { formatRelativeTime } from "#/components/pulls/pull-request-row";
import {
	removeReviewRequest,
	requestPullReviewers,
	updatePullBody,
	updatePullBranch,
} from "#/lib/github.functions";
import {
	githubOrgTeamsQueryOptions,
	githubPullPageQueryOptions,
	githubPullStatusQueryOptions,
	githubQueryKeys,
	githubRepoCollaboratorsQueryOptions,
	githubViewerQueryOptions,
} from "#/lib/github.query";
import type {
	GitHubActor,
	PullComment,
	PullCommit,
	PullDetail,
	PullPageData,
	PullStatus,
} from "#/lib/github.types";
import { githubCachePolicy } from "#/lib/github-cache-policy";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useOptimisticMutation } from "#/lib/use-optimistic-mutation";
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

	const viewerQuery = useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});

	const pr = pageQuery.data?.detail;
	const comments = pageQuery.data?.comments;
	const commits = pageQuery.data?.commits;
	const status = statusQuery.data ?? null;
	const viewer = viewerQuery.data ?? null;

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
								<div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
									<span
										className={cn(
											"shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
											stateConfig.badgeClass,
										)}
									>
										{stateConfig.label}
									</span>
									{pr.author && (
										<>
											<img
												src={pr.author.avatarUrl}
												alt={pr.author.login}
												className="size-4 shrink-0 rounded-full border border-border"
											/>
											<span className="shrink-0 font-medium text-foreground">
												{pr.author.login}
											</span>
											<span className="shrink-0">wants to merge into</span>
											<CopyBadge value={pr.baseRefName} />
											<span className="shrink-0">from</span>
											<CopyBadge value={pr.headRefName} canTruncate />
										</>
									)}
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						{/* Review request banner */}
						{viewer &&
							pr.requestedReviewers.some((r) => r.login === viewer.login) && (
								<div className="flex items-center justify-between rounded-lg bg-yellow-500/15 px-4 py-2.5">
									<span className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
										<ReviewsIcon size={15} strokeWidth={2} />
										Your review has been requested
									</span>
									<Link
										to="/$owner/$repo/review/$pullId"
										params={{ owner, repo, pullId }}
										className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 dark:bg-yellow-500 dark:text-black"
									>
										Review changes
									</Link>
								</div>
							)}

						{/* Stats bar */}
						<div className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-2.5 text-sm text-muted-foreground">
							<span className="flex items-center gap-1.5">
								<GitCommitIcon size={15} strokeWidth={2} />
								<span className="tabular-nums font-medium text-foreground">
									{pr.commits}
								</span>{" "}
								{pr.commits === 1 ? "commit" : "commits"}
							</span>
							<span className="text-muted-foreground/50">·</span>
							<span className="flex items-center gap-1.5">
								<FileIcon size={15} strokeWidth={2} />
								<span className="tabular-nums font-medium text-foreground">
									{pr.changedFiles}
								</span>{" "}
								{pr.changedFiles === 1 ? "file" : "files"} changed
							</span>
							<span className="ml-auto flex items-center gap-3 text-xs">
								<span className="flex items-center gap-1.5">
									<span className="tabular-nums font-medium text-green-500">
										+{pr.additions}
									</span>
									<span className="tabular-nums font-medium text-red-500">
										-{pr.deletions}
									</span>
									<DiffBoxes
										additions={pr.additions}
										deletions={pr.deletions}
									/>
								</span>
								{!pr.isMerged &&
									!(
										viewer &&
										pr.requestedReviewers.some((r) => r.login === viewer.login)
									) && (
										<Link
											to="/$owner/$repo/review/$pullId"
											params={{ owner, repo, pullId }}
											className="rounded-lg bg-foreground px-3 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90"
										>
											Review changes
										</Link>
									)}
							</span>
						</div>
					</div>

					{/* Body */}
					<PullBodySection
						pr={pr}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						isAuthor={viewer?.login === pr.author?.login}
						scope={scope}
					/>

					{/* Activity */}
					<div className="flex flex-col">
						<div className="flex items-center justify-between gap-2 rounded-lg bg-surface-1 px-4 py-2.5">
							<h2 className="text-xs font-medium">Activity</h2>
							{comments && commits && (
								<span className="text-xs tabular-nums text-muted-foreground">
									{comments.length + commits.length}
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

						{comments &&
							commits &&
							comments.length === 0 &&
							commits.length === 0 && (
								<p className="py-4 text-sm text-muted-foreground">
									No activity yet.
								</p>
							)}

						<ActivityTimeline
							comments={comments ?? []}
							commits={commits ?? []}
						/>

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
					{/* Labels */}
					<LabelsSection
						currentLabels={pr.labels}
						owner={owner}
						repo={repo}
						issueNumber={pullNumber}
						scope={scope}
						pageQueryKey={githubQueryKeys.pulls.page(scope, {
							owner,
							repo,
							pullNumber,
						})}
					/>

					{/* Reviewers */}
					<ReviewersSection
						pr={pr}
						owner={owner}
						repo={repo}
						pullNumber={pullNumber}
						scope={scope}
					/>

					{/* Participants */}
					<SidebarSection title="Participants">
						<ParticipantsList
							pr={pr}
							comments={comments ?? []}
							commits={commits ?? []}
						/>
					</SidebarSection>

					{/* Details */}
					<SidebarSection title="Details">
						<div className="flex flex-col gap-2 text-xs">
							<DetailRow icon={CalendarIcon} label="Created">
								{formatRelativeTime(pr.createdAt)}
							</DetailRow>
							<DetailRow icon={ClockIcon} label="Updated">
								{formatRelativeTime(pr.updatedAt)}
							</DetailRow>
							{pr.mergedAt && (
								<DetailRow icon={GitMergeIcon} label="Merged">
									{formatRelativeTime(pr.mergedAt)}
								</DetailRow>
							)}
							{pr.closedAt && !pr.mergedAt && (
								<DetailRow icon={CloseIcon} label="Closed">
									{formatRelativeTime(pr.closedAt)}
								</DetailRow>
							)}
							<DetailRow icon={CommentIcon} label="Comments">
								<span className="tabular-nums">{pr.comments}</span>
							</DetailRow>
							<DetailRow icon={MessageIcon} label="Review comments">
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

function PullBodySection({
	pr,
	owner,
	repo,
	pullNumber,
	isAuthor,
	scope,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
	pullNumber: number;
	isAuthor: boolean;
	scope: { userId: string };
}) {
	const { mutate } = useOptimisticMutation();
	const [isEditing, setIsEditing] = useState(false);
	const [editTab, setEditTab] = useState<"edit" | "preview">("edit");
	const [draft, setDraft] = useState(pr.body);
	const [isSaving, setIsSaving] = useState(false);
	const editorRef = useRef<HTMLTextAreaElement>(null);

	const insertMarkdown = useCallback(
		(before: string, after = "", placeholder = "") => {
			const ta = editorRef.current;
			if (!ta) return;
			const start = ta.selectionStart;
			const end = ta.selectionEnd;
			const selected = draft.slice(start, end);
			const text = selected || placeholder;
			const newValue = `${draft.slice(0, start)}${before}${text}${after}${draft.slice(end)}`;
			setDraft(newValue);
			requestAnimationFrame(() => {
				ta.focus();
				const cursorStart = start + before.length;
				ta.setSelectionRange(cursorStart, cursorStart + text.length);
			});
		},
		[draft],
	);

	const handleEditorKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			const mod = e.metaKey || e.ctrlKey;
			if (!mod) return;

			const shortcuts: Record<string, () => void> = {
				b: () => insertMarkdown("**", "**", "bold"),
				i: () => insertMarkdown("_", "_", "italic"),
				e: () => insertMarkdown("`", "`", "code"),
				k: () => insertMarkdown("[", "](url)", "text"),
				h: () => insertMarkdown("### ", "", "heading"),
			};

			// Shift combos
			if (e.shiftKey) {
				const shiftShortcuts: Record<string, () => void> = {
					".": () => insertMarkdown("> ", "", "quote"),
					"8": () => insertMarkdown("- ", "", "item"),
					"7": () => insertMarkdown("1. ", "", "item"),
				};
				const action = shiftShortcuts[e.key];
				if (action) {
					e.preventDefault();
					action();
				}
				return;
			}

			const action = shortcuts[e.key];
			if (action) {
				e.preventDefault();
				action();
			}
		},
		[insertMarkdown],
	);

	const pageQueryKey = githubQueryKeys.pulls.page(scope, {
		owner,
		repo,
		pullNumber,
	});

	const startEditing = () => {
		setDraft(pr.body);
		setEditTab("edit");
		setIsEditing(true);
	};

	const cancelEditing = () => {
		setIsEditing(false);
	};

	const saveBody = async () => {
		setIsSaving(true);
		try {
			await mutate({
				mutationFn: () =>
					updatePullBody({
						data: { owner, repo, pullNumber, body: draft },
					}),
				updates: [
					{
						queryKey: pageQueryKey,
						updater: (prev: PullPageData) => ({
							...prev,
							detail: prev.detail
								? { ...prev.detail, body: draft }
								: prev.detail,
						}),
					},
				],
			});
			setIsEditing(false);
		} finally {
			setIsSaving(false);
		}
	};

	if (isEditing) {
		return (
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-0.5">
						<button
							type="button"
							onClick={() => setEditTab("edit")}
							className={cn(
								"rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
								editTab === "edit"
									? "bg-surface-1 text-foreground"
									: "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
							)}
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => setEditTab("preview")}
							className={cn(
								"rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
								editTab === "preview"
									? "bg-surface-1 text-foreground"
									: "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
							)}
						>
							Preview
						</button>
					</div>
					{editTab === "edit" && (
						<TooltipProvider delayDuration={300}>
							<div className="flex items-center gap-0.5 text-muted-foreground">
								<MdToolbarButton
									label="Heading"
									shortcut="⌘H"
									onClick={() => insertMarkdown("### ", "", "heading")}
								>
									<path d="M4 12h8M4 4v16M12 4v16M20 8v8" />
								</MdToolbarButton>
								<MdToolbarButton
									label="Bold"
									shortcut="⌘B"
									onClick={() => insertMarkdown("**", "**", "bold")}
								>
									<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zM6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
								</MdToolbarButton>
								<MdToolbarButton
									label="Italic"
									shortcut="⌘I"
									onClick={() => insertMarkdown("_", "_", "italic")}
								>
									<path d="M10 4h4M8 20h4M15 4l-6 16" />
								</MdToolbarButton>
								<span className="mx-1 h-4 w-px bg-border" />
								<MdToolbarButton
									label="Code"
									shortcut="⌘E"
									onClick={() => insertMarkdown("`", "`", "code")}
								>
									<path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
								</MdToolbarButton>
								<MdToolbarButton
									label="Link"
									shortcut="⌘K"
									onClick={() => insertMarkdown("[", "](url)", "text")}
								>
									<path d="M10 14a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-.5.5" />
									<path d="M14 10a3.5 3.5 0 0 0-5 0l-4 4a3.5 3.5 0 0 0 5 5l.5-.5" />
								</MdToolbarButton>
								<MdToolbarButton
									label="Quote"
									shortcut="⌘⇧."
									onClick={() => insertMarkdown("> ", "", "quote")}
								>
									<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
									<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
								</MdToolbarButton>
								<span className="mx-1 h-4 w-px bg-border" />
								<MdToolbarButton
									label="Unordered list"
									shortcut="⌘⇧8"
									onClick={() => insertMarkdown("- ", "", "item")}
								>
									<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
								</MdToolbarButton>
								<MdToolbarButton
									label="Ordered list"
									shortcut="⌘⇧7"
									onClick={() => insertMarkdown("1. ", "", "item")}
								>
									<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M3 10h3M4 14.5a.5.5 0 0 1 .5-.5H5a.5.5 0 0 1 .5.5v0a1.5 1.5 0 0 1-1.5 1.5H3.5a.5.5 0 0 0-.5.5v0a.5.5 0 0 0 .5.5H5a.5.5 0 0 1 .5.5v0a1.5 1.5 0 0 1-1.5 1.5H3" />
								</MdToolbarButton>
								<MdToolbarButton
									label="Task list"
									onClick={() => insertMarkdown("- [ ] ", "", "task")}
								>
									<path d="M9 11l3 3L22 4" />
									<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
								</MdToolbarButton>
							</div>
						</TooltipProvider>
					)}
				</div>
				<div className="rounded-lg border bg-surface-0">
					{editTab === "edit" ? (
						<HighlightedMarkdownEditor
							value={draft}
							onChange={setDraft}
							placeholder="Write a description..."
							textareaRef={editorRef}
							onKeyDown={handleEditorKeyDown}
						/>
					) : (
						<div className="min-h-[200px] p-5">
							{draft ? (
								<Markdown>{draft}</Markdown>
							) : (
								<p className="text-sm text-muted-foreground italic">
									Nothing to preview
								</p>
							)}
						</div>
					)}
				</div>
				<div className="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onClick={cancelEditing}
						disabled={isSaving}
						className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={saveBody}
						disabled={isSaving}
						className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{isSaving ? (
							<Spinner size={13} />
						) : (
							<CheckIcon size={13} strokeWidth={2.5} />
						)}
						{isSaving ? "Saving..." : "Save"}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="relative rounded-lg border bg-surface-0 p-5">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
					>
						<MoreHorizontalIcon size={15} strokeWidth={2} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					{pr.body && (
						<DropdownMenuItem
							onSelect={() => {
								void navigator.clipboard.writeText(pr.body);
							}}
						>
							<CopyIcon size={14} strokeWidth={2} />
							Copy as Markdown
						</DropdownMenuItem>
					)}
					{isAuthor && (
						<DropdownMenuItem onSelect={startEditing}>
							<EditIcon size={14} strokeWidth={2} />
							Edit
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			{pr.body ? (
				<Markdown>{pr.body}</Markdown>
			) : (
				<p className="text-sm text-muted-foreground italic">
					No description provided.
				</p>
			)}
		</div>
	);
}

function ReviewersSection({
	pr,
	owner,
	repo,
	pullNumber,
	scope,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
	pullNumber: number;
	scope: { userId: string };
}) {
	const { mutate } = useOptimisticMutation();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [search, setSearch] = useState("");

	const collaboratorsQuery = useQuery({
		...githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
		enabled: pickerOpen,
	});
	const teamsQuery = useQuery({
		...githubOrgTeamsQueryOptions(scope, owner),
		enabled: pickerOpen,
	});
	const collaborators = collaboratorsQuery.data ?? [];
	const teams = teamsQuery.data ?? [];
	const isLoading = collaboratorsQuery.isLoading || teamsQuery.isLoading;

	const isOpen = !pr.isMerged && pr.state !== "closed";

	const requestedLogins = useMemo(
		() => new Set(pr.requestedReviewers.map((r) => r.login)),
		[pr.requestedReviewers],
	);

	const requestedTeamSlugs = useMemo(
		() => new Set(pr.requestedTeams.map((t) => t.slug)),
		[pr.requestedTeams],
	);

	const candidates = useMemo(() => {
		const authorLogin = pr.author?.login;
		return collaborators.filter((c) => c.login !== authorLogin);
	}, [collaborators, pr.author?.login]);

	const filteredUsers = useMemo(() => {
		if (!search) return candidates;
		const q = search.toLowerCase();
		return candidates.filter((c) => c.login.toLowerCase().includes(q));
	}, [candidates, search]);

	const filteredTeams = useMemo(() => {
		if (!search) return teams;
		const q = search.toLowerCase();
		return teams.filter(
			(t) =>
				t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
		);
	}, [teams, search]);

	const pageQueryKey = githubQueryKeys.pulls.page(scope, {
		owner,
		repo,
		pullNumber,
	});

	const toggleReviewer = (login: string) => {
		const isRequested = requestedLogins.has(login);
		const collaborator = collaborators.find((c) => c.login === login);

		mutate({
			mutationFn: () =>
				isRequested
					? removeReviewRequest({
							data: { owner, repo, pullNumber, reviewers: [login] },
						})
					: requestPullReviewers({
							data: { owner, repo, pullNumber, reviewers: [login] },
						}),
			updates: [
				{
					queryKey: pageQueryKey,
					updater: (prev: PullPageData) => ({
						...prev,
						detail: prev.detail
							? {
									...prev.detail,
									requestedReviewers: isRequested
										? prev.detail.requestedReviewers.filter(
												(r) => r.login !== login,
											)
										: [
												...prev.detail.requestedReviewers,
												{
													login,
													avatarUrl: collaborator?.avatarUrl ?? "",
													url: `https://github.com/${login}`,
													type: "User",
												},
											],
								}
							: prev.detail,
					}),
				},
			],
		});
	};

	const toggleTeam = (slug: string) => {
		const isRequested = requestedTeamSlugs.has(slug);
		const team = teams.find((t) => t.slug === slug);

		mutate({
			mutationFn: () =>
				isRequested
					? removeReviewRequest({
							data: { owner, repo, pullNumber, teamReviewers: [slug] },
						})
					: requestPullReviewers({
							data: { owner, repo, pullNumber, teamReviewers: [slug] },
						}),
			updates: [
				{
					queryKey: pageQueryKey,
					updater: (prev: PullPageData) => ({
						...prev,
						detail: prev.detail
							? {
									...prev.detail,
									requestedTeams: isRequested
										? prev.detail.requestedTeams.filter((t) => t.slug !== slug)
										: [
												...prev.detail.requestedTeams,
												{
													slug,
													name: team?.name ?? slug,
													url: `https://github.com/orgs/${owner}/teams/${slug}`,
												},
											],
								}
							: prev.detail,
					}),
				},
			],
		});
	};

	const hasReviewers =
		pr.requestedReviewers.length > 0 || pr.requestedTeams.length > 0;

	const [focusedIndex, setFocusedIndex] = useState(-1);
	const listRef = useRef<HTMLDivElement>(null);

	type ReviewerItem =
		| { kind: "team"; slug: string }
		| { kind: "user"; login: string };

	const flatItems = useMemo<ReviewerItem[]>(() => {
		const items: ReviewerItem[] = [];
		for (const t of filteredTeams) items.push({ kind: "team", slug: t.slug });
		for (const c of filteredUsers) items.push({ kind: "user", login: c.login });
		return items;
	}, [filteredTeams, filteredUsers]);

	const scrollToFocused = useCallback((index: number) => {
		const el = listRef.current?.querySelector(`[data-index="${index}"]`);
		if (el) {
			el.scrollIntoView({ block: "nearest" });
		}
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (flatItems.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			const next = focusedIndex < flatItems.length - 1 ? focusedIndex + 1 : 0;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			const next = focusedIndex > 0 ? focusedIndex - 1 : flatItems.length - 1;
			setFocusedIndex(next);
			scrollToFocused(next);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (focusedIndex < 0) return;
			const item = flatItems[focusedIndex];
			if (item.kind === "team") {
				toggleTeam(item.slug);
			} else {
				toggleReviewer(item.login);
			}
		}
	};

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Reviewers
				</h3>
				{isOpen && (
					<Popover
						open={pickerOpen}
						onOpenChange={(open) => {
							setPickerOpen(open);
							if (!open) {
								setSearch("");
								setFocusedIndex(-1);
							}
						}}
					>
						<PopoverTrigger asChild>
							<button
								type="button"
								className="flex size-5 items-center justify-center rounded transition-colors hover:bg-surface-2 text-muted-foreground hover:text-foreground"
							>
								<PlusSignIcon size={14} strokeWidth={2} />
							</button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-64 p-0">
							<div className="flex items-center gap-2 border-b px-3 py-2">
								<SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
								<input
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setFocusedIndex(-1);
									}}
									onKeyDown={handleKeyDown}
									placeholder="Search people and teams..."
									className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
								/>
							</div>
							<div ref={listRef} className="max-h-64 overflow-y-auto py-1">
								{isLoading ? (
									<p className="px-3 py-4 text-center text-xs text-muted-foreground">
										Loading…
									</p>
								) : filteredUsers.length === 0 && filteredTeams.length === 0 ? (
									<p className="px-3 py-4 text-center text-xs text-muted-foreground">
										No results found
									</p>
								) : (
									<>
										{filteredTeams.length > 0 && (
											<>
												<p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
													Teams
												</p>
												{filteredTeams.map((t, i) => {
													const isSelected = requestedTeamSlugs.has(t.slug);
													return (
														<button
															key={`team-${t.slug}`}
															type="button"
															data-index={i}
															onClick={() => toggleTeam(t.slug)}
															onMouseEnter={() => setFocusedIndex(i)}
															className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1 disabled:opacity-50 ${focusedIndex === i ? "bg-surface-1" : ""}`}
														>
															<div className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-surface-1 text-[10px] font-semibold text-muted-foreground">
																T
															</div>
															<span className="min-w-0 flex-1 truncate">
																{t.name}
															</span>
															{isSelected && (
																<CheckIcon
																	size={14}
																	strokeWidth={2}
																	className="shrink-0 text-green-500"
																/>
															)}
														</button>
													);
												})}
											</>
										)}
										{filteredUsers.length > 0 && (
											<>
												<p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
													People
												</p>
												{filteredUsers.map((c, i) => {
													const idx = filteredTeams.length + i;
													const isSelected = requestedLogins.has(c.login);
													return (
														<button
															key={c.login}
															type="button"
															data-index={idx}
															onClick={() => toggleReviewer(c.login)}
															onMouseEnter={() => setFocusedIndex(idx)}
															className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-1 disabled:opacity-50 ${focusedIndex === idx ? "bg-surface-1" : ""}`}
														>
															<img
																src={c.avatarUrl}
																alt={c.login}
																className="size-5 rounded-full border border-border"
															/>
															<span className="min-w-0 flex-1 truncate">
																{c.login}
															</span>
															{isSelected && (
																<CheckIcon
																	size={14}
																	strokeWidth={2}
																	className="shrink-0 text-green-500"
																/>
															)}
														</button>
													);
												})}
											</>
										)}
									</>
								)}
							</div>
						</PopoverContent>
					</Popover>
				)}
			</div>
			{hasReviewers ? (
				<div className="flex flex-col gap-2">
					{pr.requestedTeams.map((team) => (
						<div
							key={`team-${team.slug}`}
							className="group/reviewer flex items-center gap-2"
						>
							<div className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-surface-1 text-[10px] font-semibold text-muted-foreground">
								T
							</div>
							<span className="min-w-0 flex-1 truncate text-sm">
								{team.name}
							</span>
							{isOpen && (
								<button
									type="button"
									onClick={() => toggleTeam(team.slug)}
									className="flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:text-red-400 group-hover/reviewer:opacity-100 disabled:opacity-50"
								>
									<CloseIcon size={12} strokeWidth={2} />
								</button>
							)}
						</div>
					))}
					{pr.requestedReviewers.map((reviewer) => (
						<div
							key={reviewer.login}
							className="group/reviewer flex items-center gap-2"
						>
							<img
								src={reviewer.avatarUrl}
								alt={reviewer.login}
								className="size-5 rounded-full border border-border"
							/>
							<span className="min-w-0 flex-1 truncate text-sm">
								{reviewer.login}
							</span>
							{isOpen && (
								<button
									type="button"
									onClick={() => toggleReviewer(reviewer.login)}
									className="flex size-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:text-red-400 group-hover/reviewer:opacity-100 disabled:opacity-50"
								>
									<CloseIcon size={12} strokeWidth={2} />
								</button>
							)}
						</div>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">No reviewers requested</p>
			)}
		</div>
	);
}

function DetailRow({
	icon: Icon,
	label,
	children,
}: {
	icon: React.FC<{ size?: number; strokeWidth?: number }>;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<span className="flex items-center gap-1.5 text-muted-foreground">
				<Icon size={13} strokeWidth={2} />
				{label}
			</span>
			<span className="text-foreground">{children}</span>
		</div>
	);
}

function ParticipantsList({
	pr,
	comments,
	commits,
}: {
	pr: PullDetail;
	comments: Array<{ author: GitHubActor | null }>;
	commits: Array<{ author: GitHubActor | null }>;
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
	for (const commit of commits) {
		addActor(commit.author);
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

const DIFF_BOX_COUNT = 5;

function CopyBadge({
	value,
	canTruncate,
}: {
	value: string;
	canTruncate?: boolean;
}) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleClick = useCallback(() => {
		navigator.clipboard.writeText(value);
		setCopied(true);
		clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => setCopied(false), 1500);
	}, [value]);

	return (
		<Tooltip open={copied}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={handleClick}
					className={cn(
						"shrink-0 cursor-pointer rounded bg-surface-1 px-1.5 py-0.5 font-mono text-xs font-[550] transition-colors hover:bg-surface-2",
						canTruncate && "min-w-0 shrink truncate",
					)}
				>
					{value}
				</button>
			</TooltipTrigger>
			<TooltipContent>Copied!</TooltipContent>
		</Tooltip>
	);
}

function MdToolbarButton({
	label,
	shortcut,
	onClick,
	children,
}: {
	label: string;
	shortcut?: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={onClick}
					className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-surface-1 hover:text-foreground"
				>
					<svg
						aria-hidden="true"
						fill="none"
						height={15}
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						viewBox="0 0 24 24"
						width={15}
					>
						{children}
					</svg>
				</button>
			</TooltipTrigger>
			<TooltipContent>
				<span className="flex items-center gap-1.5">
					{label}
					{shortcut && (
						<kbd className="rounded bg-foreground/10 px-1 font-mono text-[10px]">
							{shortcut}
						</kbd>
					)}
				</span>
			</TooltipContent>
		</Tooltip>
	);
}

function HighlightedMarkdownEditor({
	value,
	onChange,
	placeholder,
	textareaRef: externalRef,
	onKeyDown,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
	const [highlightedHtml, setHighlightedHtml] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const internalRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = externalRef || internalRef;

	useEffect(() => {
		let cancelled = false;
		if (!value) {
			setHighlightedHtml("");
			return;
		}
		highlightCode(value, "markdown").then((html) => {
			if (!cancelled) setHighlightedHtml(html);
		});
		return () => {
			cancelled = true;
		};
	}, [value]);

	const highlightRef = useRef<HTMLDivElement>(null);

	const syncScroll = () => {
		if (highlightRef.current && textareaRef.current) {
			highlightRef.current.scrollTop = textareaRef.current.scrollTop;
			highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
		}
	};

	return (
		<div
			ref={containerRef}
			className="relative"
			style={{ height: 640, maxHeight: 1200 }}
		>
			{/* Highlighted layer */}
			<div
				ref={highlightRef}
				aria-hidden
				className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words p-5 [scrollbar-width:none] [word-break:break-all] [&::-webkit-scrollbar]:hidden [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!whitespace-pre-wrap [&_pre]:!break-words [&_pre]:font-mono [&_pre]:text-sm [&_pre]:!leading-[1.625] [&_code]:!font-mono [&_code]:!text-sm [&_code]:!leading-[1.625]"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML from shiki highlighter is trusted
				dangerouslySetInnerHTML={{ __html: highlightedHtml }}
			/>
			{/* Editable textarea */}
			<textarea
				ref={textareaRef}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={onKeyDown}
				onScroll={syncScroll}
				className="relative w-full resize-y whitespace-pre-wrap break-words bg-transparent p-5 font-mono text-sm leading-[1.625] text-transparent caret-foreground outline-none [word-break:break-all] placeholder:text-muted-foreground"
				style={{ height: 640, maxHeight: 1200 }}
				placeholder={placeholder}
				spellCheck={false}
			/>
		</div>
	);
}

function DiffBoxes({
	additions,
	deletions,
}: {
	additions: number;
	deletions: number;
}) {
	const total = additions + deletions;
	const greenCount =
		total === 0 ? 0 : Math.round((additions / total) * DIFF_BOX_COUNT);
	const redCount = total === 0 ? 0 : DIFF_BOX_COUNT - greenCount;

	const boxes: string[] = [];
	for (let i = 0; i < greenCount; i++) boxes.push("bg-green-500");
	for (let i = 0; i < redCount; i++) boxes.push("bg-red-500");
	while (boxes.length < DIFF_BOX_COUNT) boxes.push("bg-muted-foreground/30");

	return (
		<span className="flex items-center gap-px">
			{boxes.map((color, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static decorative boxes, order never changes
				<span key={i} className={cn("size-2 rounded-[2px]", color)} />
			))}
		</span>
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
					{[0, 1, 2, 3].map((section) => (
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

type TimelineItem =
	| { type: "comment"; date: string; data: PullComment }
	| { type: "commit"; date: string; data: PullCommit };

function ActivityTimeline({
	comments,
	commits,
}: {
	comments: PullComment[];
	commits: PullCommit[];
}) {
	const items: TimelineItem[] = [
		...comments.map((c) => ({
			type: "comment" as const,
			date: c.createdAt,
			data: c,
		})),
		...commits.map((c) => ({
			type: "commit" as const,
			date: c.createdAt,
			data: c,
		})),
	].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

	if (items.length === 0) return null;

	return (
		<div className="relative flex flex-col pl-8 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-[linear-gradient(to_bottom,var(--color-border)_80%,transparent)]">
			{items.map((item, i) => {
				const prevType = i > 0 ? items[i - 1].type : null;
				const nextType = i < items.length - 1 ? items[i + 1].type : null;
				const isConsecutiveCommit =
					item.type === "commit" && prevType === "commit";
				const isLastInCommitRun =
					item.type === "commit" && nextType !== "commit";

				if (item.type === "comment") {
					const comment = item.data;
					return (
						<div
							key={`comment-${comment.id}`}
							className={cn("flex flex-col gap-1 py-5", i === 0 && "pt-5")}
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
					);
				}

				const commit = item.data;
				const firstLine = commit.message.split("\n")[0];
				return (
					<div
						key={`commit-${commit.sha}`}
						className={cn(
							"flex items-center gap-1.5",
							i === 0 ? "pt-5" : isConsecutiveCommit ? "pt-2" : "pt-5",
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
						<span className="min-w-0 truncate text-sm">{firstLine}</span>
						<code className="ml-auto shrink-0 rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
							{commit.sha.slice(0, 7)}
						</code>
						<span className="shrink-0 text-xs text-muted-foreground">
							{formatRelativeTime(commit.createdAt)}
						</span>
					</div>
				);
			})}
		</div>
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
