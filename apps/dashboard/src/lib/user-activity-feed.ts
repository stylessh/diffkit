import type { UserActivityEvent } from "#/lib/github.types";

export type CommitRepo = { name: string; url: string; commits: number };

/** One line in the feed. Each carries the time it sorts by. */
export type ActivityItem =
	| { kind: "pull"; key: string; at: string; event: UserActivityEvent }
	| {
			kind: "commits";
			key: string;
			at: string;
			total: number;
			repos: CommitRepo[];
	  }
	| { kind: "event"; key: string; at: string; event: UserActivityEvent };

export type ActivityMonth = {
	key: string;
	label: string;
	items: ActivityItem[];
};

const IGNORED = new Set(["CreateEvent", "DeleteEvent"]);

const byNewest = (a: { at: string }, b: { at: string }) =>
	new Date(b.at).getTime() - new Date(a.at).getTime();

function monthKey(iso: string) {
	const date = new Date(iso);
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthItems(events: UserActivityEvent[]): ActivityItem[] {
	const items: ActivityItem[] = [];
	const latestPull = new Map<string, UserActivityEvent>();
	const commitRepos = new Map<string, CommitRepo>();
	let commitTotal = 0;
	let lastPush: string | null = null;

	for (const event of events) {
		if (IGNORED.has(event.type)) continue;
		if (event.type === "PushEvent") {
			const commits = event.commits?.length ?? 1;
			commitTotal += commits;
			if (!lastPush || event.createdAt > lastPush) lastPush = event.createdAt;
			const repo = commitRepos.get(event.repo.name);
			if (repo) repo.commits += commits;
			else
				commitRepos.set(event.repo.name, {
					name: event.repo.name,
					url: event.repo.url,
					commits,
				});
			continue;
		}
		if (event.type === "PullRequestEvent") {
			// Opened, then merged in the same month: one line, in its latest state.
			const key = `${event.repo.name}#${event.prDetail?.number ?? event.id}`;
			const seen = latestPull.get(key);
			if (!seen || event.createdAt > seen.createdAt) latestPull.set(key, event);
			continue;
		}
		items.push({ kind: "event", key: event.id, at: event.createdAt, event });
	}

	for (const [key, event] of latestPull) {
		items.push({ kind: "pull", key, at: event.createdAt, event });
	}
	if (lastPush) {
		items.push({
			kind: "commits",
			key: "commits",
			at: lastPush,
			total: commitTotal,
			repos: [...commitRepos.values()].sort((a, b) => b.commits - a.commits),
		});
	}
	return items.sort(byNewest);
}

/**
 * Events grouped by month, newest first. Within a month, pushes fold into one
 * commits line and each pull request appears once, in its latest state.
 */
export function buildActivityMonths(
	events: UserActivityEvent[],
): ActivityMonth[] {
	const months = new Map<string, UserActivityEvent[]>();
	for (const event of events) {
		const key = monthKey(event.createdAt);
		const month = months.get(key);
		if (month) month.push(event);
		else months.set(key, [event]);
	}

	return [...months.entries()]
		.sort(([a], [b]) => (a < b ? 1 : -1))
		.map(([key, monthEvents]) => ({
			key,
			label: new Date(monthEvents[0].createdAt).toLocaleDateString("en-US", {
				month: "long",
				year: "numeric",
				timeZone: "UTC",
			}),
			items: monthItems(monthEvents),
		}))
		.filter((month) => month.items.length > 0);
}
