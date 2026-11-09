import {
	CommentIcon,
	GitCommitIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	IssueClosedCompletedIcon,
	IssueClosedNotPlannedIcon,
	IssuesIcon,
} from "@diffkit/icons";
import {
	StatePill,
	type StatePillTone,
} from "@diffkit/ui/components/state-pill";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Skeleton } from "skullet/react";
import { LabelChip, RowAvatar } from "#/components/shared/list-row";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type {
	CommitReference,
	GitHubActor,
	ItemReference,
} from "#/lib/github.types";
import { commitPath, issuePath, pullPath } from "#/lib/github-links";
import {
	SAMPLE_COMMIT_REFERENCE,
	SAMPLE_ITEM_REFERENCE,
} from "./reference-samples";

type IconComponent = React.ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

type ItemAppearance = {
	icon: IconComponent;
	color: string;
	label: string;
	tone: StatePillTone;
};

const PULL_APPEARANCE = {
	open: {
		icon: GitPullRequestIcon,
		color: "text-state-open",
		label: "Open",
		tone: "open",
	},
	draft: {
		icon: GitPullRequestDraftIcon,
		color: "text-state-draft",
		label: "Draft",
		tone: "muted",
	},
	merged: {
		icon: GitMergeIcon,
		color: "text-state-merged",
		label: "Merged",
		tone: "merged",
	},
	closed: {
		icon: GitPullRequestClosedIcon,
		color: "text-state-closed",
		label: "Closed",
		tone: "closed",
	},
} satisfies Record<string, ItemAppearance>;

const ISSUE_APPEARANCE = {
	open: {
		icon: IssuesIcon,
		color: "text-state-open",
		label: "Open",
		tone: "open",
	},
	completed: {
		icon: IssueClosedCompletedIcon,
		color: "text-state-merged",
		label: "Completed",
		tone: "merged",
	},
	notPlanned: {
		icon: IssueClosedNotPlannedIcon,
		color: "text-state-draft",
		label: "Not planned",
		tone: "muted",
	},
} satisfies Record<string, ItemAppearance>;

export function itemAppearance(item: ItemReference): ItemAppearance {
	return item.kind === "pull"
		? PULL_APPEARANCE[item.status]
		: ISSUE_APPEARANCE[item.status];
}

export function itemHref(
	item: Pick<ItemReference, "kind" | "owner" | "repo" | "number">,
) {
	return item.kind === "pull"
		? pullPath(item, item.number)
		: issuePath(item, item.number);
}

function formatCardDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function CardFrame({ children }: { children: ReactNode }) {
	return <div className="flex flex-col gap-2 p-3">{children}</div>;
}

function CardEyebrow({ children }: { children: ReactNode }) {
	return (
		<p className="truncate text-xs tabular-nums text-muted-foreground">
			{children}
		</p>
	);
}

function CardTitle({
	icon,
	href,
	children,
}: {
	icon: ReactNode;
	href: string;
	children: ReactNode;
}) {
	return (
		<div className="flex items-start gap-2">
			<span className="flex h-5 shrink-0 items-center">{icon}</span>
			<Link
				to={href}
				className="min-w-0 flex-1 text-[13px] leading-5 font-medium text-foreground hover:underline"
			>
				{children}
			</Link>
		</div>
	);
}

function CardMeta({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
			{children}
		</div>
	);
}

function CardAuthor({
	actor,
	fallback,
}: {
	actor: GitHubActor | null;
	fallback?: string | null;
}) {
	const name = actor?.login ?? fallback;
	if (!name) return null;
	return (
		<span className="flex min-w-0 items-center gap-1.5">
			<RowAvatar actor={actor} />
			<span className="truncate">{name}</span>
		</span>
	);
}

function CardUnavailable({ label }: { label: string }) {
	return (
		<CardFrame>
			<p className="text-xs text-muted-foreground">
				{label} isn't available. It may be private or deleted.
			</p>
		</CardFrame>
	);
}

export type CardState<T> =
	| { status: "loading" }
	| { status: "unavailable" }
	| { status: "ready"; data: T };

export function cardState<T>(query: {
	data: T | null | undefined;
	isError: boolean;
}): CardState<T> {
	if (query.data) return { status: "ready", data: query.data };
	if (query.data === null || query.isError) return { status: "unavailable" };
	return { status: "loading" };
}

export function ItemHoverCard({
	state,
	label,
}: {
	state: CardState<ItemReference>;
	label: string;
}) {
	return (
		<Skeleton
			data={state.status === "ready" ? state.data : null}
			sample={SAMPLE_ITEM_REFERENCE}
			error={
				state.status === "unavailable" ? (
					<CardUnavailable label={label} />
				) : undefined
			}
			label="Loading preview"
		>
			{(item) => <ItemCardBody item={item} />}
		</Skeleton>
	);
}

function ItemCardBody({ item }: { item: ItemReference }) {
	const appearance = itemAppearance(item);
	const Icon = appearance.icon;
	return (
		<CardFrame>
			<CardEyebrow>
				{item.owner}/{item.repo} #{item.number} ·{" "}
				{formatCardDate(item.createdAt)}
			</CardEyebrow>
			<CardTitle
				href={itemHref(item)}
				icon={<Icon size={14} strokeWidth={2} className={appearance.color} />}
			>
				{item.title}
			</CardTitle>
			{item.excerpt ? (
				<p className="line-clamp-3 text-xs leading-[1.5] text-text-header">
					{item.excerpt}
				</p>
			) : null}
			{item.labels.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{item.labels.slice(0, 4).map((label) => (
						<LabelChip key={label.name} label={label} />
					))}
				</div>
			) : null}
			<CardMeta>
				<StatePill tone={appearance.tone}>{appearance.label}</StatePill>
				<CardAuthor actor={item.author} />
				{item.comments > 0 ? (
					<span className="flex items-center gap-1 tabular-nums">
						<CommentIcon size={12} strokeWidth={2} />
						{item.comments}
					</span>
				) : null}
			</CardMeta>
		</CardFrame>
	);
}

export function CommitHoverCard({
	state,
	label,
}: {
	state: CardState<CommitReference>;
	label: string;
}) {
	return (
		<Skeleton
			data={state.status === "ready" ? state.data : null}
			sample={SAMPLE_COMMIT_REFERENCE}
			error={
				state.status === "unavailable" ? (
					<CardUnavailable label={label} />
				) : undefined
			}
			label="Loading preview"
		>
			{(commit) => <CommitCardBody commit={commit} />}
		</Skeleton>
	);
}

function CommitCardBody({ commit }: { commit: CommitReference }) {
	return (
		<CardFrame>
			<CardEyebrow>
				{commit.owner}/{commit.repo} ·{" "}
				<span className="font-mono">{commit.sha.slice(0, 7)}</span>
			</CardEyebrow>
			<CardTitle
				href={commitPath(commit, commit.sha)}
				icon={
					<GitCommitIcon
						size={14}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
				}
			>
				{commit.title}
			</CardTitle>
			<CardMeta>
				<CardAuthor actor={commit.author} fallback={commit.authorName} />
				{commit.date ? (
					<span className="tabular-nums">
						{formatRelativeTime(commit.date)}
					</span>
				) : null}
				{commit.verified ? <StatePill tone="open">Verified</StatePill> : null}
				{commit.stats ? (
					<span className="flex items-center gap-1.5 tabular-nums">
						<span className="text-added">+{commit.stats.additions}</span>
						<span className="text-removed">−{commit.stats.deletions}</span>
					</span>
				) : null}
			</CardMeta>
		</CardFrame>
	);
}
