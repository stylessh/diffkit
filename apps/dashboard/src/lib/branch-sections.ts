import type { RepoBranchListItem } from "./github.types";

/** GitHub treats branches without commits in the last 3 months as stale. */
export const STALE_BRANCH_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

export type BranchSection = "default" | "active" | "stale";

export function classifyBranch(
	branch: Pick<RepoBranchListItem, "name" | "commit">,
	{
		defaultBranch,
		now = Date.now(),
		staleAfterMs = STALE_BRANCH_AFTER_MS,
	}: { defaultBranch: string; now?: number; staleAfterMs?: number },
): BranchSection {
	if (branch.name === defaultBranch) return "default";
	const date = branch.commit?.date
		? Date.parse(branch.commit.date)
		: Number.NaN;
	// Unknown dates count as stale: nothing proves recent activity.
	if (Number.isNaN(date)) return "stale";
	return now - date > staleAfterMs ? "stale" : "active";
}

function branchTime(branch: Pick<RepoBranchListItem, "commit">) {
	const date = branch.commit?.date
		? Date.parse(branch.commit.date)
		: Number.NaN;
	return Number.isNaN(date) ? Number.NEGATIVE_INFINITY : date;
}

/** Newest commit first, name as a stable tiebreaker. */
export function sortBranchesByRecency<
	T extends Pick<RepoBranchListItem, "name" | "commit">,
>(branches: readonly T[]): T[] {
	return [...branches].sort((a, b) => {
		const diff = branchTime(b) - branchTime(a);
		if (diff !== 0) return diff;
		return a.name.localeCompare(b.name);
	});
}

export type BranchSections<T> = {
	default: T | null;
	active: T[];
	stale: T[];
};

/**
 * Buckets loaded branches into GitHub-style sections. `defaultTip` wins over a
 * copy of the default branch found in the list (the list may not include it
 * when the repo has more branches than we loaded). Duplicate names are dropped.
 */
export function groupBranchesIntoSections<
	T extends Pick<RepoBranchListItem, "name" | "commit">,
>(
	branches: readonly T[],
	options: {
		defaultBranch: string;
		defaultTip?: T | null;
		now?: number;
		staleAfterMs?: number;
	},
): BranchSections<T> {
	const sections: BranchSections<T> = {
		default: options.defaultTip ?? null,
		active: [],
		stale: [],
	};
	const seen = new Set<string>();
	for (const branch of sortBranchesByRecency(branches)) {
		if (seen.has(branch.name)) continue;
		seen.add(branch.name);
		const section = classifyBranch(branch, options);
		if (section === "default") {
			sections.default ??= branch;
			continue;
		}
		sections[section].push(branch);
	}
	return sections;
}
