import {
	CircleIcon,
	EditIcon,
	GitBranchIcon,
	GitPullRequestClosedIcon,
	GitPullRequestIcon,
	IssueClosedCompletedIcon,
	IssueClosedNotPlannedIcon,
	IssuesIcon,
	ReviewsIcon,
	UserAddIcon,
} from "@diffkit/icons";
import { LabelPill } from "#/components/details/label-pill";
import type { TimelineEvent } from "#/lib/github.types";
import { parseCloseReason } from "#/lib/timeline-close-reason";
import { ActorMention } from "./actor-mention";

/** What a timeline belongs to. Pull requests add review, draft and branch events, and word open/close differently. */
export type TimelineSubject =
	| { kind: "issue" }
	| { kind: "pull"; headRefName: string };

const mutedIcon = {
	size: 12,
	strokeWidth: 2,
	className: "text-muted-foreground",
};

export function LabelEventIcon() {
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
}

export function ReviewRequestEventIcon() {
	return <ReviewsIcon {...mutedIcon} />;
}

function MilestoneEventIcon() {
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
}

const REVIEW_STATE_ICON_CLASS: Record<string, string> = {
	approved: "text-success",
	changes_requested: "text-danger",
	commented: "text-indigo",
};

export function getTimelineEventIcon(
	event: TimelineEvent,
	subject: TimelineSubject["kind"],
) {
	switch (event.event) {
		case "labeled":
		case "unlabeled":
			return <LabelEventIcon />;
		case "assigned":
		case "unassigned":
			return <UserAddIcon {...mutedIcon} />;
		case "review_requested":
		case "review_request_removed":
			return <ReviewRequestEventIcon />;
		case "renamed":
			return <EditIcon {...mutedIcon} />;
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
				return <IssueClosedNotPlannedIcon {...mutedIcon} />;
			}
			return subject === "pull" ? (
				<GitPullRequestClosedIcon
					size={12}
					strokeWidth={2}
					className="text-danger"
				/>
			) : (
				<IssuesIcon size={12} strokeWidth={2} className="text-merged" />
			);
		}
		case "reopened":
			return subject === "pull" ? (
				<GitPullRequestIcon
					size={12}
					strokeWidth={2}
					className="text-success"
				/>
			) : (
				<IssuesIcon size={12} strokeWidth={2} className="text-success" />
			);
		case "cross-referenced":
		case "referenced":
			return <GitPullRequestIcon {...mutedIcon} />;
		case "milestoned":
		case "demilestoned":
			return <MilestoneEventIcon />;
	}

	if (subject === "pull") {
		switch (event.event) {
			case "reviewed":
				return (
					<ReviewsIcon
						size={12}
						strokeWidth={2}
						className={
							REVIEW_STATE_ICON_CLASS[event.reviewState?.toLowerCase() ?? ""] ??
							"text-muted-foreground"
						}
					/>
				);
			case "convert_to_draft":
				return <GitPullRequestIcon {...mutedIcon} />;
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
				return <GitBranchIcon {...mutedIcon} />;
		}
	}

	return <CircleIcon {...mutedIcon} />;
}

function CloseReasonSuffix({ stateReason }: { stateReason?: string }) {
	const kind = parseCloseReason(stateReason);
	if (kind === "completed") {
		return (
			<>
				{" as "}
				<span className="font-medium text-merged">completed</span>
			</>
		);
	}
	if (kind === "not_planned") {
		return (
			<>
				{" as "}
				<span className="font-medium text-muted-foreground">not planned</span>
			</>
		);
	}
	return null;
}

function ReviewVerdict({ reviewState }: { reviewState?: string }) {
	switch (reviewState?.toLowerCase()) {
		case "approved":
			return (
				<>
					<span className="font-medium text-success">approved</span>
					{" this pull request"}
				</>
			);
		case "changes_requested":
			return <span className="font-medium text-danger">requested changes</span>;
		case "commented":
			return <span className="font-medium text-indigo">left a review</span>;
		case "dismissed":
			return (
				<span className="font-medium text-muted-foreground">
					dismissed their review
				</span>
			);
		default:
			return "reviewed";
	}
}

/** Null for an event the timeline has no sentence for; its row is then left out. */
export function getTimelineEventDescription(
	event: TimelineEvent,
	subject: TimelineSubject,
): React.ReactNode {
	const actor = <ActorMention actor={event.actor} hideAvatar />;
	const reviewer =
		event.requestedReviewer ??
		(event.requestedTeam ? { login: event.requestedTeam.name } : null);

	switch (event.event) {
		case "labeled":
		case "unlabeled":
			return (
				<span className="flex flex-wrap items-center gap-1.5">
					{actor}
					{event.event === "labeled" ? " added " : " removed "}
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
		case "unassigned":
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					{actor}
					{event.event === "assigned" ? " assigned " : " unassigned "}
					<ActorMention actor={event.assignee} />
				</span>
			);
		case "review_requested":
		case "review_request_removed":
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					{actor}
					{event.event === "review_requested"
						? " requested review from "
						: " removed review request for "}
					<ActorMention actor={reviewer} />
				</span>
			);
		case "renamed":
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					{actor}
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
				<span className="inline-flex flex-wrap items-center gap-1">
					{actor}
					{subject.kind === "pull"
						? " closed this pull request"
						: " closed this"}
					<CloseReasonSuffix stateReason={event.stateReason} />
				</span>
			);
		case "reopened":
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					{actor}
					<span className="font-medium text-success">reopened</span>
					{subject.kind === "pull" ? " this pull request" : " this issue"}
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
		case "demilestoned":
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					{actor}
					{event.event === "milestoned"
						? " added this to the "
						: " removed this from the "}
					<span className="font-medium text-foreground">
						{event.milestone?.title}
					</span>
					{" milestone"}
				</span>
			);
	}

	if (subject.kind !== "pull") return null;

	switch (event.event) {
		case "reviewed":
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					{actor}
					<ReviewVerdict reviewState={event.reviewState} />
				</span>
			);
		case "convert_to_draft":
		case "ready_for_review":
			return (
				<span className="inline-flex items-center gap-1">
					{actor}
					{event.event === "convert_to_draft"
						? " marked this as a draft"
						: " marked this as ready for review"}
				</span>
			);
		case "head_ref_deleted":
		case "head_ref_restored":
			return (
				<span className="inline-flex flex-wrap items-center gap-1">
					{actor}
					{event.event === "head_ref_deleted" ? " deleted " : " restored "}
					<code className="font-mono text-[11px] text-icon-faint">
						{subject.headRefName}
					</code>
					{" branch"}
				</span>
			);
		default:
			return null;
	}
}
