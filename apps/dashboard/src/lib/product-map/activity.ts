import type { MapFile } from "./map-file";
import { createAreaMatcher } from "./path-rules";
import {
	type ChangedFile,
	isFixTitle,
	pullParts,
	type WorkPart,
	weeklyCounts,
	weekStartOf,
} from "./work";

/** What GitHub says about a repository, reduced to what the map counts. */
export type TreeFile = { path: string };

export type PullInput = {
	number: number;
	title: string;
	state: "open" | "merged";
	author: string;
	authorAvatarUrl: string | null;
	bot: boolean;
	/** When it merged, or when it opened if it has not. */
	date: string;
	files: ChangedFile[];
	/** GitHub listed only the first files; the shares are then approximate. */
	filesTruncated: boolean;
};

export type IssueInput = {
	number: number;
	title: string;
	author: string;
	date: string;
};

export type PullWork = {
	number: number;
	title: string;
	state: "open" | "merged";
	author: string;
	date: string;
	fix: boolean;
	parts: WorkPart[];
	approximate: boolean;
};

export type MapPerson = {
	login: string;
	avatarUrl: string | null;
	bot: boolean;
	pulls: number;
};

export type HotFile = {
	path: string;
	changes: { pull: number; lines: number }[];
};

export type AreaActivity = {
	files: number;
	testFiles: number;
	mergedPulls: number;
	mergedLast30: number;
	openPulls: number;
	lastMerged: string | null;
	/** Merged pull requests per week, from `MapActivity.weekStart`. */
	weekly: number[];
	/** Every pull request with lines here, oldest first. */
	pulls: number[];
	openIssues: number[];
	people: { login: string; pulls: number }[];
	/**
	 * The files still in the area that the most pull requests changed: where
	 * to start reading, worked out rather than written down. Each carries the
	 * pull requests that changed it, oldest first, and the lines each changed
	 * in that file.
	 */
	hotFiles: HotFile[];
};

export type MapActivity = {
	analysedAt: string;
	weekStart: string;
	totals: {
		files: number;
		unmappedFiles: number;
		mergedPulls: number;
		openPulls: number;
		people: number;
	};
	areas: Record<string, AreaActivity>;
	pulls: Record<number, PullWork>;
	issues: Record<number, IssueInput & { note?: string }>;
	people: Record<string, MapPerson>;
	/** Set when GitHub cut a listing short, so the page can say so. */
	limits: { treeTruncated: boolean; pullsTruncated: boolean };
};

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MAX_WEEKS = 52;
const HOT_FILES = 6;
const TEST_FILE =
	/(^|[./_-])(test|spec)s?[./_-]|(^|\/)(__tests__|tests?|e2e)\//i;

function emptyArea(): AreaActivity {
	return {
		files: 0,
		testFiles: 0,
		mergedPulls: 0,
		mergedLast30: 0,
		openPulls: 0,
		lastMerged: null,
		weekly: [],
		pulls: [],
		openIssues: [],
		people: [],
		hotFiles: [],
	};
}

/**
 * Joins a map file with the repository's files, pull requests and open issues.
 * Pure, so the numbers on the page can be tested without GitHub.
 */
export function buildMapActivity({
	map,
	tree,
	pulls,
	issues,
	now,
	limits,
}: {
	map: MapFile;
	tree: readonly TreeFile[];
	pulls: readonly PullInput[];
	issues: readonly IssueInput[];
	now: Date;
	limits: MapActivity["limits"];
}): MapActivity {
	const match = createAreaMatcher(map.rules, map.ignore);
	const areas: Record<string, AreaActivity> = {};
	for (const area of map.areas) areas[area.id] = emptyArea();

	const totals = {
		files: 0,
		unmappedFiles: 0,
		mergedPulls: 0,
		openPulls: 0,
		people: 0,
	};
	const present = new Set<string>();
	for (const file of tree) {
		present.add(file.path);
		const found = match(file.path);
		if (found.kind === "ignored") continue;
		totals.files += 1;
		if (found.kind === "unmapped") {
			totals.unmappedFiles += 1;
			continue;
		}
		const area = areas[found.area];
		area.files += 1;
		if (TEST_FILE.test(file.path)) area.testFiles += 1;
	}

	const oldestFirst = [...pulls].sort(
		(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
	);
	const firstMerged = oldestFirst.find((pull) => pull.state === "merged");
	const thisWeek = weekStartOf(now);
	const firstWeek = Math.max(
		firstMerged ? weekStartOf(new Date(firstMerged.date)) : thisWeek,
		thisWeek - (MAX_WEEKS - 1) * WEEK_MS,
	);
	const weeks = Math.round((thisWeek - firstWeek) / WEEK_MS) + 1;
	const recent = now.getTime() - 30 * DAY_MS;

	const work: Record<number, PullWork> = {};
	const people: Record<string, MapPerson> = {};
	const mergedDates: Record<string, string[]> = {};
	const authorsByArea: Record<string, Map<string, number>> = {};
	const changesByArea: Record<string, Map<string, HotFile["changes"]>> = {};
	for (const area of map.areas) {
		mergedDates[area.id] = [];
		authorsByArea[area.id] = new Map();
		changesByArea[area.id] = new Map();
	}
	for (const pull of oldestFirst) {
		const parts = pullParts(pull.files, match);
		if (parts.length === 0) continue;
		work[pull.number] = {
			number: pull.number,
			title: pull.title,
			state: pull.state,
			author: pull.author,
			date: pull.date,
			fix: isFixTitle(pull.title),
			parts,
			approximate: pull.filesTruncated,
		};
		for (const file of pull.files) {
			const found = match(file.path);
			if (found.kind !== "area" || !present.has(file.path)) continue;
			const changes = changesByArea[found.area];
			const fileChanges = changes.get(file.path) ?? [];
			fileChanges.push({
				pull: pull.number,
				lines: file.additions + file.deletions,
			});
			changes.set(file.path, fileChanges);
		}
		const merged = pull.state === "merged";
		if (merged) totals.mergedPulls += 1;
		else totals.openPulls += 1;
		people[pull.author] ??= {
			login: pull.author,
			avatarUrl: pull.authorAvatarUrl,
			bot: pull.bot,
			pulls: 0,
		};
		people[pull.author].pulls += 1;
		for (const part of parts) {
			const area = areas[part.area];
			area.pulls.push(pull.number);
			const authors = authorsByArea[part.area];
			authors.set(pull.author, (authors.get(pull.author) ?? 0) + 1);
			if (!merged) {
				area.openPulls += 1;
				continue;
			}
			area.mergedPulls += 1;
			area.lastMerged = pull.date;
			if (new Date(pull.date).getTime() >= recent) area.mergedLast30 += 1;
			mergedDates[part.area].push(pull.date);
		}
	}
	totals.people = Object.keys(people).length;

	const openIssues = new Map(issues.map((issue) => [issue.number, issue]));
	const shownIssues: MapActivity["issues"] = {};
	for (const hint of map.issues) {
		const issue = openIssues.get(hint.number);
		if (!issue) continue;
		shownIssues[issue.number] = hint.note
			? { ...issue, note: hint.note }
			: issue;
		for (const id of hint.areas) areas[id].openIssues.push(issue.number);
	}

	for (const [id, area] of Object.entries(areas)) {
		area.weekly = weeklyCounts(mergedDates[id], firstWeek, weeks);
		area.people = [...authorsByArea[id]]
			.map(([login, count]) => ({ login, pulls: count }))
			.sort((a, b) => b.pulls - a.pulls);
		area.hotFiles = [...changesByArea[id]]
			.map(([path, changes]) => ({ path, changes }))
			.sort(
				(a, b) =>
					b.changes.length - a.changes.length || a.path.localeCompare(b.path),
			)
			.slice(0, HOT_FILES);
	}

	return {
		analysedAt: now.toISOString(),
		weekStart: new Date(firstWeek).toISOString(),
		totals,
		areas,
		pulls: work,
		issues: shownIssues,
		people,
		limits,
	};
}
