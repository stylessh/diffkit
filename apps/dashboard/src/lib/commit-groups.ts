import type { RepoCommitSummary } from "./github.types";

export type CommitGroup<T> = {
	/** Stable React key: the period, or `YYYY-MM` for a month. */
	key: string;
	/** Short heading: "Today", "Last week", "October 2026". */
	title: string;
	/** Accessible name: "Commits today", "Commits in October 2026". */
	label: string;
	commits: T[];
};

type GroupOptions = {
	/** IANA zone; defaults to the runtime's local zone. */
	timeZone?: string;
	locale?: string;
	now?: number;
};

const DAY_MS = 86_400_000;

type Period =
	| { key: "today" | "yesterday" | "this-week" | "last-week" }
	| { key: "month"; month: string; date: Date };

const RECENT: Record<
	"today" | "yesterday" | "this-week" | "last-week",
	{ title: string; label: string }
> = {
	today: { title: "Today", label: "Commits today" },
	yesterday: { title: "Yesterday", label: "Commits yesterday" },
	"this-week": { title: "This week", label: "Commits this week" },
	"last-week": { title: "Last week", label: "Commits last week" },
};

function dayKeyFormatter(timeZone?: string) {
	// en-CA formats as YYYY-MM-DD.
	return new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone,
	});
}

/** Days since the epoch for a `YYYY-MM-DD` calendar date. */
function dayNumber(dayKey: string) {
	const [year, month, day] = dayKey.split("-").map(Number);
	return Date.UTC(year, month - 1, day) / DAY_MS;
}

/**
 * Groups commits into recent periods (today, yesterday, this week, last week;
 * weeks start on Monday) and then calendar months, like the pull request and
 * issue lists group by state. Keeps the input order (GitHub returns newest
 * first); an out-of-order commit rejoins its period. Commits with an
 * unparseable date land in a trailing "Unknown date" group.
 */
export function groupCommitsByPeriod<T extends Pick<RepoCommitSummary, "date">>(
	commits: readonly T[],
	options: GroupOptions = {},
): CommitGroup<T>[] {
	const dayKey = dayKeyFormatter(options.timeZone);
	const monthFormat = new Intl.DateTimeFormat(options.locale ?? "en-US", {
		month: "long",
		year: "numeric",
		timeZone: options.timeZone,
	});
	const today = dayNumber(dayKey.format(new Date(options.now ?? Date.now())));
	// 1970-01-01 was a Thursday: day 0 is weekday 3 counting from Monday.
	const daysSinceMonday = (((today + 3) % 7) + 7) % 7;

	const periodOf = (date: Date): Period => {
		const key = dayKey.format(date);
		const age = today - dayNumber(key);
		if (age <= 0) return { key: "today" };
		if (age === 1) return { key: "yesterday" };
		if (age <= daysSinceMonday) return { key: "this-week" };
		if (age <= daysSinceMonday + 7) return { key: "last-week" };
		return { key: "month", month: key.slice(0, 7), date };
	};

	const groups: CommitGroup<T>[] = [];
	const byKey = new Map<string, CommitGroup<T>>();
	let unknown: CommitGroup<T> | null = null;

	for (const commit of commits) {
		const date = new Date(commit.date);
		if (Number.isNaN(date.getTime())) {
			unknown ??= {
				key: "unknown",
				title: "Unknown date",
				label: "Commits with an unknown date",
				commits: [],
			};
			unknown.commits.push(commit);
			continue;
		}
		const period = periodOf(date);
		const key = period.key === "month" ? period.month : period.key;
		const existing = byKey.get(key);
		if (existing) {
			existing.commits.push(commit);
			continue;
		}
		const heading =
			period.key === "month"
				? {
						title: monthFormat.format(period.date),
						label: `Commits in ${monthFormat.format(period.date)}`,
					}
				: RECENT[period.key];
		const group: CommitGroup<T> = { key, ...heading, commits: [commit] };
		byKey.set(key, group);
		groups.push(group);
	}

	if (unknown) groups.push(unknown);
	return groups;
}

/** Splits a commit message into its subject line and (trimmed) body. */
export function splitCommitMessage(message: string): {
	subject: string;
	body: string;
} {
	const newline = message.indexOf("\n");
	if (newline === -1) return { subject: message.trim(), body: "" };
	return {
		subject: message.slice(0, newline).trim(),
		body: message.slice(newline + 1).trim(),
	};
}

/** Case-insensitive message filter for pages GitHub search can't cover (non-default refs). */
export function filterCommitsByMessage<T extends { message: string }>(
	commits: readonly T[],
	query: string,
): T[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...commits];
	return commits.filter((commit) =>
		commit.message.toLowerCase().includes(needle),
	);
}
