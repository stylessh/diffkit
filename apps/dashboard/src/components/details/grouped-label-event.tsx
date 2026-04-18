import { cn } from "@diffkit/ui/lib/utils";
import { Fragment, type ReactNode } from "react";
import { LabelPill } from "#/components/details/label-pill";
import type {
	GitHubActor,
	GroupedIssueStateToggleEvent,
	GroupedLabelEvent,
	GroupedReviewRequestEvent,
	TimelineEvent,
} from "#/lib/github.types";
import { parseCloseReason } from "#/lib/timeline-close-reason";

const GROUP_THRESHOLD_MS = 60_000;

type GroupedItem<T> =
	| T
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
	  };

/**
 * Groups consecutive timeline events by the same actor within a short window:
 * label changes, review requests, and reopen/close toggles.
 */
export function groupTimelineEvents<
	T extends { type: string; date: string; data: unknown },
>(items: T[]): GroupedItem<T>[] {
	const result: GroupedItem<T>[] = [];

	let i = 0;
	while (i < items.length) {
		const item = items[i];

		if (item.type !== "event") {
			result.push(item);
			i++;
			continue;
		}

		const event = item.data as TimelineEvent;

		if (event.event === "labeled" || event.event === "unlabeled") {
			const actor = event.actor;
			const events: TimelineEvent[] = [event];
			let j = i + 1;
			while (j < items.length) {
				const next = items[j];
				if (next.type !== "event") break;

				const nextEvent = next.data as TimelineEvent;
				const nextIsLabel =
					nextEvent.event === "labeled" || nextEvent.event === "unlabeled";
				if (!nextIsLabel) break;
				if (nextEvent.actor?.login !== actor?.login) break;

				const timeDiff = Math.abs(
					new Date(nextEvent.createdAt).getTime() -
						new Date(event.createdAt).getTime(),
				);
				if (timeDiff > GROUP_THRESHOLD_MS) break;

				events.push(nextEvent);
				j++;
			}

			if (events.length === 1) {
				result.push(item);
				i++;
				continue;
			}

			const added: { name: string; color: string }[] = [];
			const removed: { name: string; color: string }[] = [];
			for (const e of events) {
				if (!e.label) continue;
				if (e.event === "labeled") added.push(e.label);
				else removed.push(e.label);
			}
			result.push({
				type: "label_group" as const,
				date: item.date,
				data: { actor, added, removed, createdAt: item.date },
			});
			i = j;
			continue;
		}

		if (
			event.event === "review_requested" ||
			event.event === "review_request_removed"
		) {
			const actor = event.actor;
			const events: TimelineEvent[] = [event];
			let j = i + 1;
			while (j < items.length) {
				const next = items[j];
				if (next.type !== "event") break;

				const nextEvent = next.data as TimelineEvent;
				const nextIsReviewRequest =
					nextEvent.event === "review_requested" ||
					nextEvent.event === "review_request_removed";
				if (!nextIsReviewRequest) break;
				if (nextEvent.actor?.login !== actor?.login) break;

				const timeDiff = Math.abs(
					new Date(nextEvent.createdAt).getTime() -
						new Date(event.createdAt).getTime(),
				);
				if (timeDiff > GROUP_THRESHOLD_MS) break;

				events.push(nextEvent);
				j++;
			}

			if (events.length === 1) {
				result.push(item);
				i++;
				continue;
			}

			const requested: (GitHubActor | { login: string })[] = [];
			const removed: (GitHubActor | { login: string })[] = [];
			for (const e of events) {
				const reviewer =
					e.requestedReviewer ??
					(e.requestedTeam ? { login: e.requestedTeam.name } : null);
				if (!reviewer) continue;
				if (e.event === "review_requested") requested.push(reviewer);
				else removed.push(reviewer);
			}
			result.push({
				type: "review_request_group" as const,
				date: item.date,
				data: { actor, requested, removed, createdAt: item.date },
			});
			i = j;
			continue;
		}

		if (event.event === "reopened" || event.event === "closed") {
			const actor = event.actor;
			const events: TimelineEvent[] = [event];
			const firstTs = new Date(event.createdAt).getTime();
			let j = i + 1;
			while (j < items.length) {
				const next = items[j];
				if (next.type !== "event") break;

				const nextEvent = next.data as TimelineEvent;
				if (nextEvent.event !== "reopened" && nextEvent.event !== "closed") {
					break;
				}
				if (nextEvent.actor?.login !== actor?.login) break;

				const timeDiff = Math.abs(
					new Date(nextEvent.createdAt).getTime() - firstTs,
				);
				if (timeDiff > GROUP_THRESHOLD_MS) break;

				events.push(nextEvent);
				j++;
			}

			if (events.length >= 2) {
				result.push({
					type: "issue_state_toggle_group" as const,
					date: item.date,
					data: {
						actor,
						events,
						createdAt: item.date,
					},
				});
				i = j;
			} else {
				result.push(item);
				i++;
			}
			continue;
		}

		result.push(item);
		i++;
	}

	return result;
}

export function GroupedLabelDescription({
	group,
}: {
	group: GroupedLabelEvent;
}) {
	return (
		<span className="flex flex-wrap items-center gap-1.5">
			<ActorMention actor={group.actor} />
			{group.added.length > 0 && (
				<>
					{" added "}
					{group.added.map((label) => (
						<LabelPill
							key={label.name}
							name={label.name}
							color={label.color}
							size="sm"
						/>
					))}
				</>
			)}
			{group.added.length > 0 && group.removed.length > 0 && " and"}
			{group.removed.length > 0 && (
				<>
					{" removed "}
					{group.removed.map((label) => (
						<LabelPill
							key={label.name}
							name={label.name}
							color={label.color}
							size="sm"
						/>
					))}
				</>
			)}
			{" labels"}
		</span>
	);
}

export function GroupedReviewRequestDescription({
	group,
}: {
	group: GroupedReviewRequestEvent;
}) {
	return (
		<span className="inline-flex flex-wrap items-center gap-1">
			<ActorMention actor={group.actor} />
			{group.requested.length > 0 && (
				<>
					{" requested review from "}
					{group.requested.map((reviewer, i) => (
						<span key={reviewer.login}>
							{i > 0 && ", "}
							<ActorMention actor={reviewer} />
						</span>
					))}
				</>
			)}
			{group.requested.length > 0 && group.removed.length > 0 && " and"}
			{group.removed.length > 0 && (
				<>
					{" removed review request for "}
					{group.removed.map((reviewer, i) => (
						<span key={reviewer.login}>
							{i > 0 && ", "}
							<ActorMention actor={reviewer} />
						</span>
					))}
				</>
			)}
		</span>
	);
}

export function GroupedIssueStateToggleDescription({
	group,
	subject,
	mergeCloseReason,
}: {
	group: GroupedIssueStateToggleEvent;
	subject: "issue" | "pull";
	mergeCloseReason: (e: TimelineEvent) => TimelineEvent;
}) {
	const merged = group.events.map(mergeCloseReason);
	const noun = subject === "issue" ? "this issue" : "this pull request";

	const segments: ReactNode[] = [];
	for (let idx = 0; idx < merged.length; idx++) {
		const ev = merged[idx];
		const isFirst = idx === 0;

		if (ev.event === "reopened") {
			segments.push(
				<Fragment key={`r-${ev.id}-${idx}`}>
					<span className="font-medium text-green-600 dark:text-green-400">
						reopened
					</span>
					{isFirst ? ` ${noun}` : " it"}
				</Fragment>,
			);
		} else {
			const kind = parseCloseReason(ev.stateReason);
			segments.push(
				<Fragment key={`c-${ev.id}-${idx}`}>
					<span
						className={cn(
							"font-medium",
							kind === "completed" && "text-violet-500",
							kind === "not_planned" && "text-muted-foreground",
							kind === "other" &&
								(subject === "pull"
									? "text-rose-600 dark:text-rose-400"
									: "text-violet-500"),
						)}
					>
						closed
					</span>
					{isFirst ? ` ${noun}` : " it"}
					{kind === "completed" && (
						<>
							{" as "}
							<span className="font-medium text-violet-500">completed</span>
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
				</Fragment>,
			);
		}
	}

	return (
		<span className="inline-flex flex-wrap items-baseline gap-x-0">
			<ActorMention actor={group.actor} />{" "}
			{segments.map((seg, idx) => (
				<Fragment
					key={`${group.events[idx]?.id ?? "x"}-${group.events[idx]?.event ?? idx}`}
				>
					{idx > 0 && (idx === segments.length - 1 ? " and " : ", ")}
					{seg}
				</Fragment>
			))}
		</span>
	);
}

function ActorMention({
	actor,
}: {
	actor: GitHubActor | { login: string } | null | undefined;
}) {
	const login = actor?.login ?? "someone";
	return (
		<span className="inline-flex items-center gap-1 font-medium text-foreground">
			{login}
		</span>
	);
}
