import { LabelPill } from "#/components/details/label-pill";
import type {
	GitHubActor,
	GroupedLabelEvent,
	GroupedReviewRequestEvent,
	TimelineEvent,
} from "#/lib/github.types";

const GROUP_THRESHOLD_MS = 60_000;

type GroupedItem<T> =
	| T
	| { type: "label_group"; date: string; data: GroupedLabelEvent }
	| {
			type: "review_request_group";
			date: string;
			data: GroupedReviewRequestEvent;
	  };

/**
 * Groups consecutive label and review-request events by the same actor
 * that occur within a short time window into single grouped items.
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

		const isLabel = event.event === "labeled" || event.event === "unlabeled";
		const isReviewRequest =
			event.event === "review_requested" ||
			event.event === "review_request_removed";

		if (!isLabel && !isReviewRequest) {
			result.push(item);
			i++;
			continue;
		}

		// Collect consecutive events of the same kind by the same actor
		const actor = event.actor;
		const eventKind = isLabel ? "label" : "review_request";
		const events: TimelineEvent[] = [event];

		let j = i + 1;
		while (j < items.length) {
			const next = items[j];
			if (next.type !== "event") break;

			const nextEvent = next.data as TimelineEvent;
			const nextIsLabel =
				nextEvent.event === "labeled" || nextEvent.event === "unlabeled";
			const nextIsReviewRequest =
				nextEvent.event === "review_requested" ||
				nextEvent.event === "review_request_removed";
			const nextKind = nextIsLabel
				? "label"
				: nextIsReviewRequest
					? "review_request"
					: null;

			if (nextKind !== eventKind) break;
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

		if (eventKind === "label") {
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
		} else {
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
		}

		i = j;
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
