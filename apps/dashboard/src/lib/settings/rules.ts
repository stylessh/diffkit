export type RulesetTarget = "branch" | "tag" | "push" | "repository";
export type RulesetEnforcement = "active" | "evaluate" | "disabled";

export type RepoRuleset = {
	id: number;
	name: string;
	target: RulesetTarget;
	enforcement: RulesetEnforcement;
	inherited: boolean;
	includes: string[];
	excludes: string[];
	rules: string[];
	bypassActorCount: number;
	updatedAt: string | null;
	htmlUrl: string | null;
};

export type RawRulesetSummary = {
	id: number;
	name: string;
	target?: string;
	source_type?: string;
	enforcement?: string;
	updated_at?: string | null;
	_links?: { html?: { href?: string } | null } | null;
};

export type RawRulesetRule = {
	type: string;
	parameters?: Record<string, unknown> | null;
};

export type RawRulesetDetail = {
	conditions?: {
		ref_name?: { include?: string[]; exclude?: string[] } | null;
	} | null;
	rules?: RawRulesetRule[] | null;
	bypass_actors?: unknown[] | null;
};

function parseTarget(value: string | undefined): RulesetTarget {
	switch (value) {
		case "tag":
		case "push":
		case "repository":
			return value;
		default:
			return "branch";
	}
}

function parseEnforcement(value: string | undefined): RulesetEnforcement {
	return value === "active" || value === "evaluate" ? value : "disabled";
}

export function formatRefPattern(pattern: string) {
	switch (pattern) {
		case "~DEFAULT_BRANCH":
			return "Default branch";
		case "~ALL":
			return "All branches and tags";
		default:
			return pattern.replace(/^refs\/(heads|tags)\//, "");
	}
}

const RULE_LABELS: Record<string, string> = {
	creation: "Restrict creations",
	update: "Restrict updates",
	deletion: "Restrict deletions",
	required_linear_history: "Require linear history",
	required_signatures: "Require signed commits",
	non_fast_forward: "Block force pushes",
	required_deployments: "Require deployments to succeed",
	merge_queue: "Require a merge queue",
	code_scanning: "Require code scanning results",
	workflows: "Require workflows to pass",
	commit_message_pattern: "Restrict commit messages",
	commit_author_email_pattern: "Restrict commit author emails",
	committer_email_pattern: "Restrict committer emails",
	branch_name_pattern: "Restrict branch names",
	tag_name_pattern: "Restrict tag names",
	file_path_restriction: "Restrict file paths",
	max_file_size: "Restrict file size",
};

function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function humanizeRuleType(type: string) {
	const words = type.replace(/_/g, " ");
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function describeRule(rule: RawRulesetRule) {
	const parameters = rule.parameters ?? {};
	if (rule.type === "pull_request") {
		const approvals = Number(parameters.required_approving_review_count ?? 0);
		return approvals > 0
			? `Require a pull request (${plural(approvals, "approval")})`
			: "Require a pull request";
	}
	if (rule.type === "required_status_checks") {
		const checks = Array.isArray(parameters.required_status_checks)
			? parameters.required_status_checks.length
			: 0;
		return checks > 0
			? `Require status checks (${checks})`
			: "Require status checks";
	}
	return RULE_LABELS[rule.type] ?? humanizeRuleType(rule.type);
}

export function mapRuleset(
	summary: RawRulesetSummary,
	detail: RawRulesetDetail | null,
): RepoRuleset {
	const refs = detail?.conditions?.ref_name;
	return {
		id: summary.id,
		name: summary.name,
		target: parseTarget(summary.target),
		enforcement: parseEnforcement(summary.enforcement),
		inherited: summary.source_type === "Organization",
		includes: (refs?.include ?? []).map(formatRefPattern),
		excludes: (refs?.exclude ?? []).map(formatRefPattern),
		rules: (detail?.rules ?? []).map(describeRule),
		bypassActorCount: detail?.bypass_actors?.length ?? 0,
		updatedAt: summary.updated_at ?? null,
		htmlUrl: summary._links?.html?.href ?? null,
	};
}

export type BranchProtection = {
	branch: string;
	rules: string[] | null;
};

type RawToggle = { enabled?: boolean } | null | undefined;

export type RawBranchProtection = {
	required_status_checks?: {
		strict?: boolean;
		contexts?: string[];
		checks?: { context: string }[];
	} | null;
	required_pull_request_reviews?: {
		required_approving_review_count?: number;
		dismiss_stale_reviews?: boolean;
		require_code_owner_reviews?: boolean;
	} | null;
	enforce_admins?: RawToggle;
	required_signatures?: RawToggle;
	required_linear_history?: RawToggle;
	allow_force_pushes?: RawToggle;
	allow_deletions?: RawToggle;
	required_conversation_resolution?: RawToggle;
	lock_branch?: RawToggle;
};

function requiredCheckNames(
	checks: NonNullable<RawBranchProtection["required_status_checks"]>,
) {
	const names = checks.checks?.map((check) => check.context) ?? [];
	return [...new Set([...names, ...(checks.contexts ?? [])])];
}

export function mapBranchProtection(
	branch: string,
	raw: RawBranchProtection,
): BranchProtection & { rules: string[] } {
	const rules: string[] = [];
	const reviews = raw.required_pull_request_reviews;
	if (reviews) {
		const approvals = reviews.required_approving_review_count ?? 0;
		rules.push(
			approvals > 0
				? `Require a pull request (${plural(approvals, "approval")})`
				: "Require a pull request",
		);
		if (reviews.dismiss_stale_reviews) rules.push("Dismiss stale approvals");
		if (reviews.require_code_owner_reviews) {
			rules.push("Require code owner review");
		}
	}
	if (raw.required_status_checks) {
		const names = requiredCheckNames(raw.required_status_checks);
		rules.push(
			names.length > 0
				? `Require status checks (${names.join(", ")})`
				: "Require status checks",
		);
		if (raw.required_status_checks.strict) rules.push("Require up-to-date");
	}
	if (raw.required_signatures?.enabled) rules.push("Require signed commits");
	if (raw.required_linear_history?.enabled) {
		rules.push("Require linear history");
	}
	if (raw.required_conversation_resolution?.enabled) {
		rules.push("Require conversation resolution");
	}
	if (raw.lock_branch?.enabled) rules.push("Lock branch");
	if (!raw.allow_force_pushes?.enabled) rules.push("Block force pushes");
	if (!raw.allow_deletions?.enabled) rules.push("Block deletions");
	if (raw.enforce_admins?.enabled) rules.push("Include administrators");
	return { branch, rules };
}
