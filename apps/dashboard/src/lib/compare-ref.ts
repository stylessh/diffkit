const RANGE_SEPARATOR = "...";
const OWNER_SEPARATOR = ":";

export type CompareRefs = {
	base: string | null;
	head: string | null;
};

function nonEmpty(value: string) {
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

export function parseCompareSplat(splat: string): CompareRefs {
	const separatorAt = splat.indexOf(RANGE_SEPARATOR);
	if (separatorAt === -1) return { base: null, head: nonEmpty(splat) };
	return {
		base: nonEmpty(splat.slice(0, separatorAt)),
		head: nonEmpty(splat.slice(separatorAt + RANGE_SEPARATOR.length)),
	};
}

export function formatCompareSplat(base: string, head: string | null) {
	return `${base}${RANGE_SEPARATOR}${head ?? ""}`;
}

export function resolveCompareRefs(
	refs: CompareRefs,
	defaultBranch: string,
): CompareRefs {
	return { base: refs.base ?? defaultBranch, head: refs.head };
}

/** Git ref names cannot contain `:`, so it unambiguously marks a fork owner. */
export function splitCompareRef(ref: string): {
	owner: string | null;
	branch: string;
} {
	const separatorAt = ref.indexOf(OWNER_SEPARATOR);
	if (separatorAt <= 0) return { owner: null, branch: ref };
	return {
		owner: ref.slice(0, separatorAt),
		branch: ref.slice(separatorAt + OWNER_SEPARATOR.length),
	};
}

export function isForkRef(ref: string, repoOwner: string) {
	const { owner } = splitCompareRef(ref);
	return owner !== null && owner.toLowerCase() !== repoOwner.toLowerCase();
}

export function isQualifiedRef(value: string) {
	const { owner, branch } = splitCompareRef(value.trim());
	return owner !== null && branch !== "";
}

/** The `head` filter of GitHub's pull request list: always `owner:branch`. */
export function pullHeadFilter(head: string, repoOwner: string) {
	const { owner, branch } = splitCompareRef(head);
	return `${owner ?? repoOwner}:${branch}`;
}
