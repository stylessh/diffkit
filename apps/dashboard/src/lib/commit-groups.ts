import type { RepoCommitSummary } from "./github.types";

export type CommitDayGroup<T> = {
	/** `YYYY-MM-DD` in the grouping time zone — stable React key. */
	key: string;
	/** "Commits on Tue, Nov 4, 2026" */
	label: string;
	commits: T[];
};

type GroupOptions = {
	/** IANA zone; defaults to the runtime's local zone. */
	timeZone?: string;
	locale?: string;
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

function dayLabelFormatter(timeZone?: string, locale = "en-US") {
	return new Intl.DateTimeFormat(locale, {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone,
	});
}

/**
 * Groups commits into consecutive calendar-day buckets, preserving the input
 * order (GitHub returns newest first). Commits with an unparseable date land in
 * a trailing "Unknown date" bucket instead of being dropped.
 */
export function groupCommitsByDay<T extends Pick<RepoCommitSummary, "date">>(
	commits: readonly T[],
	options: GroupOptions = {},
): CommitDayGroup<T>[] {
	const keyFormat = dayKeyFormatter(options.timeZone);
	const labelFormat = dayLabelFormatter(options.timeZone, options.locale);
	const groups: CommitDayGroup<T>[] = [];
	const byKey = new Map<string, CommitDayGroup<T>>();
	let unknown: CommitDayGroup<T> | null = null;

	for (const commit of commits) {
		const date = new Date(commit.date);
		if (Number.isNaN(date.getTime())) {
			unknown ??= { key: "unknown", label: "Unknown date", commits: [] };
			unknown.commits.push(commit);
			continue;
		}
		const key = keyFormat.format(date);
		const last = groups.at(-1);
		if (last?.key === key) {
			last.commits.push(commit);
			continue;
		}
		// Out-of-order dates (rebases, cherry-picks) rejoin their existing day.
		const existing = byKey.get(key);
		if (existing) {
			existing.commits.push(commit);
			continue;
		}
		const group = {
			key,
			label: `Commits on ${labelFormat.format(date)}`,
			commits: [commit],
		};
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
