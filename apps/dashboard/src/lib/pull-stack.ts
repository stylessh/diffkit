/**
 * Branch-derived stacked pull request detection.
 *
 * PR B is stacked on PR A when B targets the branch A is opened from
 * (`B.base.ref === A.head.ref`) and A's head branch lives in the same
 * repository (a fork branch that merely shares a name with B's base is not a
 * parent). Everything here is pure so it can be unit tested and reused by the
 * repo list, the PR detail sidebar and the review page without new requests.
 */

export type StackablePull = {
	number: number;
	state: string;
	/** Branch the PR merges into. */
	baseRefName?: string | null;
	/** Branch the PR is opened from. */
	headRefName?: string | null;
	/**
	 * `owner/repo` of the repository the head branch lives in. `null` (deleted
	 * fork) or `undefined` (source did not provide it) means the PR can never be
	 * a parent, because the head cannot be shown to be in this repository.
	 */
	headRepoFullName?: string | null;
	updatedAt?: string;
};

export type PullStackEntry<T extends StackablePull> = {
	pull: T;
	/** 0 for the stack root, 1 for its children, … */
	depth: number;
	/** Zero-based position in depth-first order within the stack. */
	index: number;
};

export type PullStack<T extends StackablePull> = {
	rootNumber: number;
	/** Depth-first order, parents before children, siblings by PR number. */
	entries: PullStackEntry<T>[];
};

export type PullStackIndex<T extends StackablePull> = {
	stacks: PullStack<T>[];
	stackByNumber: Map<number, PullStack<T>>;
	parentByNumber: Map<number, number>;
	childrenByNumber: Map<number, number[]>;
	pullByNumber: Map<number, T>;
};

export type BuildPullStackOptions = {
	/** `owner/repo` the pulls belong to; used for the same-repo head check. */
	repoFullName: string;
	/**
	 * Branches that can never act as a stack parent (typically the default
	 * branch, for PRs opened *from* it).
	 */
	ignoredBranches?: readonly string[];
};

function isOpen(pull: StackablePull) {
	return pull.state.trim().toLowerCase() === "open";
}

function updatedAtMs(pull: StackablePull) {
	const parsed = pull.updatedAt ? Date.parse(pull.updatedAt) : Number.NaN;
	return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildPullStackIndex<T extends StackablePull>(
	pulls: readonly T[],
	options: BuildPullStackOptions,
): PullStackIndex<T> {
	const repoKey = options.repoFullName.trim().toLowerCase();
	const ignored = new Set(options.ignoredBranches ?? []);

	// Last write wins when the same PR appears twice (e.g. list + detail merge).
	const pullByNumber = new Map<number, T>();
	for (const pull of pulls) {
		if (isOpen(pull)) pullByNumber.set(pull.number, pull);
	}
	const open = [...pullByNumber.values()].sort((a, b) => a.number - b.number);

	const parentCandidatesByBranch = new Map<string, T[]>();
	for (const pull of open) {
		const head = pull.headRefName?.trim();
		if (!head || ignored.has(head)) continue;
		if (pull.headRepoFullName?.trim().toLowerCase() !== repoKey) continue;
		const list = parentCandidatesByBranch.get(head) ?? [];
		list.push(pull);
		parentCandidatesByBranch.set(head, list);
	}

	const parentByNumber = new Map<number, number>();
	for (const child of open) {
		const base = child.baseRefName?.trim();
		if (!base) continue;
		let best: T | null = null;
		for (const candidate of parentCandidatesByBranch.get(base) ?? []) {
			if (candidate.number === child.number) continue;
			if (
				!best ||
				updatedAtMs(candidate) > updatedAtMs(best) ||
				(updatedAtMs(candidate) === updatedAtMs(best) &&
					candidate.number < best.number)
			) {
				best = candidate;
			}
		}
		if (best) parentByNumber.set(child.number, best.number);
	}

	// Break cycles (A targets B's branch while B targets A's) deterministically:
	// the lowest-numbered PR in the loop ends up as the child, the other as root.
	for (const { number: start } of open) {
		const seen = new Set<number>([start]);
		let cursor = start;
		while (true) {
			const next = parentByNumber.get(cursor);
			if (next === undefined) break;
			if (seen.has(next)) {
				parentByNumber.delete(cursor);
				break;
			}
			seen.add(next);
			cursor = next;
		}
	}

	const childrenByNumber = new Map<number, number[]>();
	for (const [child, parent] of parentByNumber) {
		const list = childrenByNumber.get(parent) ?? [];
		list.push(child);
		childrenByNumber.set(parent, list);
	}
	for (const list of childrenByNumber.values()) list.sort((a, b) => a - b);

	const stacks: PullStack<T>[] = [];
	const stackByNumber = new Map<number, PullStack<T>>();
	for (const pull of open) {
		const isRoot = !parentByNumber.has(pull.number);
		if (!isRoot || !childrenByNumber.has(pull.number)) continue;

		const entries: PullStackEntry<T>[] = [];
		const visit = (number: number, depth: number) => {
			const member = pullByNumber.get(number);
			if (!member) return;
			entries.push({ pull: member, depth, index: entries.length });
			for (const childNumber of childrenByNumber.get(number) ?? []) {
				visit(childNumber, depth + 1);
			}
		};
		visit(pull.number, 0);

		const stack: PullStack<T> = { rootNumber: pull.number, entries };
		stacks.push(stack);
		for (const entry of entries) stackByNumber.set(entry.pull.number, stack);
	}

	return {
		stacks,
		stackByNumber,
		parentByNumber,
		childrenByNumber,
		pullByNumber,
	};
}

export type PullStackContext<T extends StackablePull> = {
	stack: PullStack<T>;
	current: PullStackEntry<T>;
	/** Ancestors from the stack root down to (and including) the direct parent. */
	ancestors: T[];
	parent: T | null;
	children: T[];
	/** One-based position in depth-first order, e.g. `2` in "2 of 3". */
	position: number;
	size: number;
};

/** Stack details for one PR, or `null` when it is not part of a stack. */
export function getPullStackContext<T extends StackablePull>(
	index: PullStackIndex<T>,
	pullNumber: number,
): PullStackContext<T> | null {
	const stack = index.stackByNumber.get(pullNumber);
	if (!stack) return null;
	const current = stack.entries.find(
		(entry) => entry.pull.number === pullNumber,
	);
	if (!current) return null;

	const ancestors: T[] = [];
	let cursor = index.parentByNumber.get(pullNumber);
	while (cursor !== undefined) {
		const ancestor = index.pullByNumber.get(cursor);
		if (!ancestor) break;
		ancestors.unshift(ancestor);
		cursor = index.parentByNumber.get(cursor);
	}

	const children: T[] = [];
	for (const childNumber of index.childrenByNumber.get(pullNumber) ?? []) {
		const child = index.pullByNumber.get(childNumber);
		if (child) children.push(child);
	}

	return {
		stack,
		current,
		ancestors,
		parent: ancestors.at(-1) ?? null,
		children,
		position: current.index + 1,
		size: stack.entries.length,
	};
}

export type PullListItem<T extends StackablePull> =
	| { kind: "pull"; pull: T }
	| {
			kind: "stack";
			rootNumber: number;
			/** Total members of the stack, including any hidden by filters. */
			size: number;
			/** Visible members only, depth-first. */
			entries: PullStackEntry<T>[];
	  };

/**
 * Collapse a (possibly filtered/sorted) list into display items. A stack is
 * emitted at the position of its first visible member so the list keeps the
 * caller's ordering; a stack with a single visible member degrades to a plain
 * row.
 */
export function groupPullsByStack<T extends StackablePull>(
	visible: readonly T[],
	index: PullStackIndex<T>,
): PullListItem<T>[] {
	const visibleNumbers = new Set(visible.map((pull) => pull.number));
	const emitted = new Set<PullStack<T>>();
	const items: PullListItem<T>[] = [];

	for (const pull of visible) {
		const stack = index.stackByNumber.get(pull.number);
		if (!stack) {
			items.push({ kind: "pull", pull });
			continue;
		}
		if (emitted.has(stack)) continue;
		emitted.add(stack);

		const entries = stack.entries.filter((entry) =>
			visibleNumbers.has(entry.pull.number),
		);
		if (entries.length < 2) {
			items.push({ kind: "pull", pull });
			continue;
		}
		items.push({
			kind: "stack",
			rootNumber: stack.rootNumber,
			size: stack.entries.length,
			entries,
		});
	}

	return items;
}

/**
 * Build a stackable view of a PR detail. Details are fresher than list
 * entries (the base branch may have just been retargeted) so callers merge
 * this over the list entry for the current PR.
 */
export function stackablePullFromDetail(
	detail: {
		number: number;
		state: string;
		updatedAt?: string;
		baseRefName?: string | null;
		headRefName?: string | null;
		headRepoOwner?: string | null;
		headRepoFullName?: string | null;
	},
	repoFullName: string,
): StackablePull {
	const [owner = ""] = repoFullName.split("/");
	// GitHub does not allow a fork under the same account/org as its parent, so
	// matching owners imply the head is in this repository.
	const headRepoFullName =
		detail.headRepoFullName ??
		(detail.headRepoOwner &&
		detail.headRepoOwner.toLowerCase() === owner.toLowerCase()
			? repoFullName
			: null);
	return {
		number: detail.number,
		state: detail.state,
		updatedAt: detail.updatedAt,
		baseRefName: detail.baseRefName,
		headRefName: detail.headRefName,
		headRepoFullName,
	};
}
