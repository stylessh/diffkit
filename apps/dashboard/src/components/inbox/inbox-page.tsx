import {
	ArchiveDownIcon,
	CheckIcon,
	CommentIcon,
	ExternalLinkIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestIcon,
	InboxIcon,
	IssuesIcon,
	MoreHorizontalIcon,
	NotificationIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useMemo, useState } from "react";
import { IssueDetailContent } from "#/components/issues/detail/issue-detail-page";
import { DashboardContentLoading } from "#/components/layouts/dashboard-content-loading";
import { PullDetailContent } from "#/components/pulls/detail/pull-detail-page";
import { formatRelativeTime } from "#/lib/format-relative-time";
import {
	markAllNotificationsRead,
	markNotificationDone,
	markNotificationRead,
} from "#/lib/github.functions";
import {
	type GitHubQueryScope,
	githubIssuePageQueryOptions,
	githubNotificationsQueryOptions,
	githubPullPageQueryOptions,
	githubQueryKeys,
} from "#/lib/github.query";
import type {
	NotificationItem,
	NotificationParticipant,
	NotificationsResult,
} from "#/lib/github.types";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
import { useHasMounted } from "#/lib/use-has-mounted";

const routeApi = getRouteApi("/_protected/inbox");

type InboxFilter = "unread" | "all";

const AVATAR_MAX_VISIBLE = 4;
const AVATAR_SIZE = 24;
const AVATAR_OVERLAP = 8;

// Hoisted regexes — avoids recreation per call (js-hoist-regexp)
const RE_PULLS_NUMBER = /\/(?:pulls|issues)\/(\d+)$/;
const RE_API_PULLS = /\/repos\/[^/]+\/[^/]+\/pulls\/(\d+)$/;
const RE_API_ISSUES = /\/repos\/[^/]+\/[^/]+\/issues\/(\d+)$/;
const RE_API_COMMITS = /\/repos\/[^/]+\/[^/]+\/commits\/([a-f0-9]+)$/;
const RE_API_RELEASES = /\/repos\/[^/]+\/[^/]+\/releases\/(\d+)$/;

function AvatarStack({
	participants,
}: {
	participants: NotificationParticipant[] | undefined;
}) {
	if (!participants || participants.length === 0) return null;

	const visible = participants.slice(0, AVATAR_MAX_VISIBLE);
	const overflow = participants.length - AVATAR_MAX_VISIBLE;
	const totalWidth =
		AVATAR_SIZE +
		(visible.length - 1 + (overflow > 0 ? 1 : 0)) *
			(AVATAR_SIZE - AVATAR_OVERLAP);

	return (
		<div
			className="relative flex shrink-0"
			style={{ width: totalWidth, height: AVATAR_SIZE }}
		>
			{visible.map((p, i) => (
				<img
					key={p.login}
					src={p.avatarUrl}
					alt={p.login}
					title={p.login}
					className="absolute rounded-full border-2 border-card object-cover"
					style={{
						width: AVATAR_SIZE,
						height: AVATAR_SIZE,
						left: i * (AVATAR_SIZE - AVATAR_OVERLAP),
						zIndex: visible.length - i,
					}}
				/>
			))}
			{overflow > 0 && (
				<div
					className="absolute flex items-center justify-center rounded-full border-2 border-card bg-surface-2 text-[9px] font-medium text-muted-foreground"
					style={{
						width: AVATAR_SIZE,
						height: AVATAR_SIZE,
						left: visible.length * (AVATAR_SIZE - AVATAR_OVERLAP),
						zIndex: 0,
					}}
				>
					+{overflow}
				</div>
			)}
		</div>
	);
}

export function InboxPage() {
	const { user } = routeApi.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const hasMounted = useHasMounted();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [filter, setFilter] = useState<InboxFilter>("unread");

	const queryInput = useMemo(() => ({ all: filter === "all" }), [filter]);
	const queryKey = useMemo(
		() => githubQueryKeys.notifications.list(scope, queryInput),
		[scope, queryInput],
	);
	const webhookRefreshTargets = useMemo(
		() => [
			{
				queryKey,
				signalKeys: [githubRevalidationSignalKeys.notifications],
			},
		],
		[queryKey],
	);
	const query = useQuery({
		...githubNotificationsQueryOptions(scope, queryInput),
		enabled: hasMounted,
	});
	useGitHubSignalStream(webhookRefreshTargets);

	const queryClient = useQueryClient();
	const notifications = query.data?.notifications ?? [];
	const selected = notifications.find((n) => n.id === selectedId) ?? null;

	const handleSelect = useCallback(
		(notification: NotificationItem) => {
			setSelectedId(notification.id);

			// Prefetch the next notification's detail data
			const idx = notifications.findIndex((n) => n.id === notification.id);
			const next = idx >= 0 ? notifications[idx + 1] : null;
			if (next) {
				const parsed = parseSubjectRef(next);
				if (parsed?.type === "PullRequest") {
					queryClient.prefetchQuery(
						githubPullPageQueryOptions(scope, {
							owner: parsed.owner,
							repo: parsed.repo,
							pullNumber: parsed.number,
						}),
					);
				} else if (parsed?.type === "Issue") {
					queryClient.prefetchQuery(
						githubIssuePageQueryOptions(scope, {
							owner: parsed.owner,
							repo: parsed.repo,
							issueNumber: parsed.number,
						}),
					);
				}
			}
		},
		[notifications, queryClient, scope],
	);

	if (query.error) throw query.error;
	if (!hasMounted || (!query.data && query.isLoading))
		return <DashboardContentLoading />;

	return (
		<div className="flex h-full">
			<InboxSidebar
				notifications={notifications}
				selectedId={selectedId}
				onSelect={handleSelect}
				filter={filter}
				onFilterChange={setFilter}
				scope={scope}
				isRefetching={query.isFetching}
			/>
			<InboxPreview notification={selected} scope={scope} userId={user.id} />
		</div>
	);
}

const InboxSidebar = memo(function InboxSidebar({
	notifications,
	selectedId,
	onSelect,
	filter,
	onFilterChange,
	scope,
	isRefetching,
}: {
	notifications: NotificationItem[];
	selectedId: string | null;
	onSelect: (notification: NotificationItem) => void;
	filter: InboxFilter;
	onFilterChange: (filter: InboxFilter) => void;
	scope: GitHubQueryScope;
	isRefetching: boolean;
}) {
	const queryClient = useQueryClient();
	const queryKey = githubQueryKeys.notifications.list(scope, {
		all: filter === "all",
	});
	const markAllRead = useMutation({
		mutationFn: () => markAllNotificationsRead(),
		onMutate: () => {
			const prev = queryClient.getQueryData<NotificationsResult>(queryKey);
			if (prev) {
				queryClient.setQueryData<NotificationsResult>(queryKey, {
					...prev,
					notifications: prev.notifications.map((n) => ({
						...n,
						unread: false,
					})),
				});
			}
			return { prev };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
		},
	});

	const markAllDone = useMutation({
		mutationFn: async () => {
			const readNotifications = notifications.filter((n) => !n.unread);
			await Promise.all(
				readNotifications.map((n) =>
					markNotificationDone({ data: { threadId: n.id } }),
				),
			);
		},
		onMutate: () => {
			const prev = queryClient.getQueryData<NotificationsResult>(queryKey);
			if (prev) {
				queryClient.setQueryData<NotificationsResult>(queryKey, {
					...prev,
					notifications: prev.notifications.filter((n) => n.unread),
				});
			}
			return { prev };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
		},
	});

	const hasUnread = notifications.some((n) => n.unread);

	return (
		<aside className="flex h-full w-full flex-col border-r border-border md:w-80 md:min-w-80 lg:w-96 lg:min-w-96">
			<div className="flex h-12 items-center justify-between gap-2 border-b border-border px-4">
				<div className="flex items-center gap-2">
					<h1 className="text-base font-semibold">Inbox</h1>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-7 text-muted-foreground"
								iconLeft={<MoreHorizontalIcon size={15} strokeWidth={2} />}
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuItem
								disabled={!hasUnread || markAllRead.isPending}
								onSelect={() => markAllRead.mutate()}
							>
								<CheckIcon size={15} strokeWidth={2} />
								Mark all as read
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={notifications.length === 0 || markAllDone.isPending}
								onSelect={() => markAllDone.mutate()}
							>
								<ArchiveDownIcon size={15} strokeWidth={2} />
								Archive all read
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="flex items-center gap-1">
					{isRefetching && <Spinner className="size-3 text-muted-foreground" />}
					<Button
						variant="ghost"
						size="sm"
						className={cn(
							"h-7 px-2 text-xs",
							filter === "unread"
								? "bg-surface-1 text-foreground"
								: "text-muted-foreground",
						)}
						onClick={() => onFilterChange("unread")}
					>
						Unread
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className={cn(
							"h-7 px-2 text-xs",
							filter === "all"
								? "bg-surface-1 text-foreground"
								: "text-muted-foreground",
						)}
						onClick={() => onFilterChange("all")}
					>
						All
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-auto">
				{notifications.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
						<div className="flex size-12 items-center justify-center rounded-xl bg-surface-1">
							<InboxIcon
								size={22}
								strokeWidth={1.5}
								className="text-muted-foreground"
							/>
						</div>
						<div className="flex flex-col gap-1">
							<p className="text-sm font-medium">All caught up</p>
							<p className="text-xs text-muted-foreground">
								No {filter === "unread" ? "unread " : ""}notifications
							</p>
						</div>
					</div>
				) : (
					<div className="flex flex-col">
						<AnimatePresence initial={false}>
							{notifications.map((notification) => (
								<InboxRow
									key={notification.id}
									notification={notification}
									isSelected={notification.id === selectedId}
									onSelect={onSelect}
									scope={scope}
									filter={filter}
								/>
							))}
						</AnimatePresence>
					</div>
				)}
			</div>
		</aside>
	);
});

const reasonLabels: Record<string, string> = {
	assign: "Assigned",
	author: "Author",
	comment: "Comment",
	ci_activity: "CI",
	invitation: "Invited",
	manual: "Subscribed",
	mention: "Mentioned",
	review_requested: "Review requested",
	security_alert: "Security",
	state_change: "State change",
	subscribed: "Subscribed",
	team_mention: "Team mention",
};

function getSubjectIcon(type: string, state: string | null) {
	switch (type) {
		case "PullRequest":
			if (state === "merged") return GitMergeIcon;
			if (state === "closed") return GitPullRequestClosedIcon;
			return GitPullRequestIcon;
		case "Issue":
			return IssuesIcon;
		case "Commit":
			return GitMergeIcon;
		case "Discussion":
			return CommentIcon;
		default:
			return NotificationIcon;
	}
}

function getSubjectColor(type: string, state: string | null) {
	switch (type) {
		case "PullRequest":
			if (state === "merged") return "text-purple-500";
			if (state === "closed") return "text-red-500";
			return "text-green-500";
		case "Issue":
			if (state === "closed") return "text-red-500";
			return "text-green-500";
		case "Commit":
			return "text-blue-500";
		default:
			return "text-muted-foreground";
	}
}

function extractSubjectNumber(url: string | null): number | null {
	if (!url) return null;
	const match = url.match(RE_PULLS_NUMBER);
	return match ? Number.parseInt(match[1], 10) : null;
}

const InboxRow = memo(function InboxRow({
	notification,
	isSelected,
	onSelect,
	scope,
	filter,
}: {
	notification: NotificationItem;
	isSelected: boolean;
	onSelect: (notification: NotificationItem) => void;
	scope: GitHubQueryScope;
	filter: InboxFilter;
}) {
	const queryClient = useQueryClient();
	const Icon = getSubjectIcon(
		notification.subject.type,
		notification.subjectState,
	);
	const iconColor = getSubjectColor(
		notification.subject.type,
		notification.subjectState,
	);
	const number = extractSubjectNumber(notification.subject.url);

	const queryKey = githubQueryKeys.notifications.list(scope, {
		all: filter === "all",
	});

	const markDone = useMutation({
		mutationFn: () =>
			markNotificationDone({ data: { threadId: notification.id } }),
		onMutate: () => {
			const prev = queryClient.getQueryData<NotificationsResult>(queryKey);
			if (prev) {
				queryClient.setQueryData<NotificationsResult>(queryKey, {
					...prev,
					notifications: prev.notifications.filter(
						(n) => n.id !== notification.id,
					),
				});
			}
			return { prev };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
		},
	});

	const markRead = useMutation({
		mutationFn: () =>
			markNotificationRead({ data: { threadId: notification.id } }),
		onMutate: () => {
			const prev = queryClient.getQueryData<NotificationsResult>(queryKey);
			if (prev) {
				queryClient.setQueryData<NotificationsResult>(queryKey, {
					...prev,
					notifications: prev.notifications.map((n) =>
						n.id === notification.id ? { ...n, unread: false } : n,
					),
				});
			}
			return { prev };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
		},
	});

	return (
		<motion.div
			role="button"
			tabIndex={0}
			layout
			initial={{ opacity: 0, y: -4 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, height: 0, overflow: "hidden" }}
			transition={{ type: "spring", stiffness: 500, damping: 35 }}
			onClick={() => {
				onSelect(notification);
				if (notification.unread) {
					markRead.mutate();
				}
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect(notification);
					if (notification.unread) {
						markRead.mutate();
					}
				}
			}}
			className={cn(
				"group flex w-full cursor-pointer items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors last:border-b-0",
				"hover:[&:not(:has([data-action]:hover))]:bg-surface-1",
				isSelected && "bg-surface-1",
			)}
		>
			<div className={cn("mt-0.5 shrink-0", iconColor)}>
				<Icon size={16} strokeWidth={2} />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-3">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<span className="truncate text-xs text-muted-foreground">
							{notification.repository.fullName}
							{number ? ` #${number}` : ""}
						</span>
						{notification.unread && (
							<span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
						)}
					</div>
					<p
						className={cn(
							"line-clamp-2 text-sm",
							notification.unread ? "font-medium" : "text-muted-foreground",
						)}
					>
						{notification.subject.title}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{reasonLabels[notification.reason] ?? notification.reason}
					</span>
					<span className="text-xs text-muted-foreground/50">·</span>
					<span className="text-xs text-muted-foreground">
						{formatRelativeTime(notification.updatedAt)}
					</span>
				</div>
			</div>
			<div className="relative flex shrink-0 items-center">
				<div className="transition-opacity group-hover:opacity-0">
					<AvatarStack participants={notification.participants} />
				</div>
				<div className="absolute inset-0 flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						type="button"
						data-action
						onClick={(e) => {
							e.stopPropagation();
							markDone.mutate();
						}}
						disabled={markDone.isPending}
						className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
						title="Mark as done"
					>
						{markDone.isPending ? (
							<Spinner className="size-3.5" />
						) : (
							<ArchiveDownIcon size={14} strokeWidth={2} />
						)}
					</button>
					{notification.unread && (
						<button
							type="button"
							data-action
							onClick={(e) => {
								e.stopPropagation();
								markRead.mutate();
							}}
							disabled={markRead.isPending}
							className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
							title="Mark as read"
						>
							{markRead.isPending ? (
								<Spinner className="size-3.5" />
							) : (
								<CheckIcon size={14} strokeWidth={2} />
							)}
						</button>
					)}
				</div>
			</div>
		</motion.div>
	);
});

const InboxPreview = memo(function InboxPreview({
	notification,
	userId,
}: {
	notification: NotificationItem | null;
	scope: GitHubQueryScope;
	userId: string;
}) {
	if (!notification) {
		return (
			<div className="hidden flex-1 items-center justify-center md:flex">
				<div className="flex flex-col items-center gap-3 text-center">
					<div className="flex size-14 items-center justify-center rounded-2xl bg-surface-1">
						<InboxIcon
							size={26}
							strokeWidth={1.5}
							className="text-muted-foreground"
						/>
					</div>
					<div className="flex flex-col gap-1">
						<p className="text-sm font-medium">Select a notification</p>
						<p className="text-xs text-muted-foreground">
							Choose a notification from the list to preview
						</p>
					</div>
				</div>
			</div>
		);
	}

	const parsed = parseSubjectRef(notification);
	const internalHref = buildInternalHref(notification);

	return (
		<div className="hidden flex-1 flex-col md:flex">
			<div className="flex h-12 items-center justify-between border-b border-border px-4">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Link
						to="/$owner/$repo"
						params={{
							owner: notification.repository.owner.login,
							repo: notification.repository.name,
						}}
						className="flex items-center gap-2 transition-colors hover:text-foreground"
					>
						<img
							src={notification.repository.owner.avatarUrl}
							alt={notification.repository.owner.login}
							className="size-4 rounded-full"
						/>
						<span>{notification.repository.fullName}</span>
					</Link>
					{parsed?.number ? <span>#{parsed.number}</span> : null}
				</div>
				{internalHref && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs"
						iconLeft={<ExternalLinkIcon size={14} strokeWidth={2} />}
						asChild
					>
						<Link to={internalHref}>Open in tab</Link>
					</Button>
				)}
			</div>
			<div className="flex-1 overflow-hidden">
				<InboxPreviewContent
					key={notification.id}
					notification={notification}
					parsed={parsed}
					userId={userId}
				/>
			</div>
		</div>
	);
});

type ParsedSubjectRef = {
	type: "PullRequest" | "Issue";
	owner: string;
	repo: string;
	number: number;
};

function parseSubjectRef(
	notification: NotificationItem,
): ParsedSubjectRef | null {
	const url = notification.subject.url;
	if (!url) return null;
	const owner = notification.repository.owner.login;
	const repo = notification.repository.name;

	const pullMatch = url.match(RE_API_PULLS);
	if (pullMatch) {
		return {
			type: "PullRequest",
			owner,
			repo,
			number: Number.parseInt(pullMatch[1], 10),
		};
	}

	const issueMatch = url.match(RE_API_ISSUES);
	if (issueMatch) {
		return {
			type: "Issue",
			owner,
			repo,
			number: Number.parseInt(issueMatch[1], 10),
		};
	}

	return null;
}

function InboxPreviewContent({
	notification,
	parsed,
	userId,
}: {
	notification: NotificationItem;
	parsed: ParsedSubjectRef | null;
	userId: string;
}) {
	if (parsed?.type === "PullRequest") {
		return (
			<PullDetailContent
				owner={parsed.owner}
				repo={parsed.repo}
				pullNumber={parsed.number}
				userId={userId}
			/>
		);
	}

	if (parsed?.type === "Issue") {
		return (
			<IssueDetailContent
				owner={parsed.owner}
				repo={parsed.repo}
				issueNumber={parsed.number}
				userId={userId}
			/>
		);
	}

	return <InboxPreviewFallback notification={notification} />;
}

function InboxPreviewFallback({
	notification,
}: {
	notification: NotificationItem;
}) {
	const Icon = getSubjectIcon(
		notification.subject.type,
		notification.subjectState,
	);
	const iconColor = getSubjectColor(
		notification.subject.type,
		notification.subjectState,
	);
	const ghUrl = buildGitHubUrl(notification);

	return (
		<div className="flex flex-col gap-4 p-6">
			<div className="flex items-start gap-3">
				<div className={cn("mt-1 shrink-0", iconColor)}>
					<Icon size={20} strokeWidth={2} />
				</div>
				<div className="flex flex-col gap-2">
					<h2 className="text-lg font-semibold tracking-tight">
						{notification.subject.title}
					</h2>
					<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						<span className="rounded-md bg-surface-1 px-2 py-0.5 text-xs">
							{notification.subject.type}
						</span>
						<span>·</span>
						<span>
							{reasonLabels[notification.reason] ?? notification.reason}
						</span>
						<span>·</span>
						<span>{formatRelativeTime(notification.updatedAt)}</span>
					</div>
				</div>
			</div>

			<div className="rounded-xl border border-border bg-surface-1 p-5">
				<div className="flex items-center gap-3">
					<img
						src={notification.repository.owner.avatarUrl}
						alt={notification.repository.owner.login}
						className="size-8 rounded-full"
					/>
					<div className="flex flex-col">
						<span className="text-sm font-medium">
							{notification.repository.fullName}
						</span>
						<span className="text-xs text-muted-foreground">
							{notification.repository.private
								? "Private repository"
								: "Public repository"}
						</span>
					</div>
				</div>
			</div>

			{ghUrl && (
				<a
					href={ghUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					View on GitHub →
				</a>
			)}
		</div>
	);
}

function buildGitHubUrl(notification: NotificationItem): string | null {
	const { subject, repository } = notification;
	const base = `https://github.com/${repository.fullName}`;

	if (!subject.url) return base;

	// subject.url is an API URL like https://api.github.com/repos/owner/repo/pulls/123
	const pullMatch = subject.url.match(RE_API_PULLS);
	if (pullMatch) return `${base}/pull/${pullMatch[1]}`;

	const issueMatch = subject.url.match(RE_API_ISSUES);
	if (issueMatch) return `${base}/issues/${issueMatch[1]}`;

	const commitMatch = subject.url.match(RE_API_COMMITS);
	if (commitMatch) return `${base}/commit/${commitMatch[1]}`;

	const releaseMatch = subject.url.match(RE_API_RELEASES);
	if (releaseMatch) return `${base}/releases`;

	return base;
}

function buildInternalHref(notification: NotificationItem): string | null {
	const { subject, repository } = notification;
	const owner = repository.owner.login;
	const repo = repository.name;

	if (!subject.url) return null;

	const pullMatch = subject.url.match(RE_API_PULLS);
	if (pullMatch) return `/${owner}/${repo}/pull/${pullMatch[1]}`;

	const issueMatch = subject.url.match(RE_API_ISSUES);
	if (issueMatch) return `/${owner}/${repo}/issues/${issueMatch[1]}`;

	return null;
}
