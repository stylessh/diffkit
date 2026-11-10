import { getViewer } from "./client";
import type { GitHubContext, RepositoryPermissions } from "./shared";

export type BranchTarget = { owner: string; repo: string; branch: string };

export type BranchRule = {
	type?: string;
	ruleset_id?: number;
	parameters?: unknown;
};

type GitHubRepositoryRuleset = {
	current_user_can_bypass?:
		| "always"
		| "pull_requests_only"
		| "never"
		| "exempt";
};

type GitHubBranchProtection = {
	enforce_admins?: {
		enabled?: boolean;
	};
	required_pull_request_reviews?: {
		bypass_pull_request_allowances?: {
			users?: Array<{ login?: string }>;
			teams?: Array<{ slug?: string }>;
			apps?: Array<{ slug?: string }>;
		};
	};
};

type GitHubUserTeam = {
	slug?: string;
	organization?: {
		login?: string;
	};
};

export type BypassCandidate = {
	context: GitHubContext;
	rules: () => Promise<BranchRule[]>;
};

/** The branch-rules endpoint covers both rulesets and classic branch protection. */
export async function listBranchRules(
	context: GitHubContext,
	target: BranchTarget,
): Promise<BranchRule[]> {
	const response = await context.octokit.request(
		"GET /repos/{owner}/{repo}/rules/branches/{branch}",
		{ ...target, per_page: 100 },
	);
	return response.data as BranchRule[];
}

export function requiredStatusContexts(rules: BranchRule[]): string[] {
	const contexts = new Set<string>();
	for (const rule of rules) {
		if (rule.type !== "required_status_checks") continue;
		if (!rule.parameters || typeof rule.parameters !== "object") continue;
		const required = (
			rule.parameters as {
				required_status_checks?: Array<{ context?: unknown }>;
			}
		).required_status_checks;
		if (!Array.isArray(required)) continue;
		for (const entry of required) {
			if (entry && typeof entry.context === "string") {
				contexts.add(entry.context);
			}
		}
	}
	return Array.from(contexts);
}

function isBypassableRulesetMode(
	mode: GitHubRepositoryRuleset["current_user_can_bypass"] | undefined,
) {
	return (
		mode === "always" || mode === "pull_requests_only" || mode === "exempt"
	);
}

async function rulesetsAllowBypass(
	candidate: BypassCandidate,
	target: BranchTarget,
): Promise<boolean | null> {
	try {
		const rules = await candidate.rules();
		const rulesetIds = Array.from(
			new Set(
				rules
					.map((rule) => rule.ruleset_id)
					.filter((id): id is number => typeof id === "number"),
			),
		);
		if (rulesetIds.length === 0) {
			return null;
		}

		const rulesets = await Promise.all(
			rulesetIds.map(async (rulesetId) => {
				const response = await candidate.context.octokit.request(
					"GET /repos/{owner}/{repo}/rulesets/{ruleset_id}",
					{
						owner: target.owner,
						repo: target.repo,
						ruleset_id: rulesetId,
						includes_parents: true,
					},
				);
				return response.data as GitHubRepositoryRuleset;
			}),
		);

		if (
			rulesets.some((ruleset) => ruleset.current_user_can_bypass === "never")
		) {
			return false;
		}
		if (
			rulesets.every((ruleset) =>
				isBypassableRulesetMode(ruleset.current_user_can_bypass),
			)
		) {
			return true;
		}
		return null;
	} catch {
		return null;
	}
}

/** `null` when no candidate's rulesets settle the question. */
export async function getRulesetBypassState(
	candidates: BypassCandidate[],
	target: BranchTarget,
): Promise<boolean | null> {
	for (const candidate of candidates) {
		const state = await rulesetsAllowBypass(candidate, target);
		if (state !== null) {
			return state;
		}
	}
	return null;
}

function loginMatches(left: string | undefined, right: string) {
	return left?.toLowerCase() === right.toLowerCase();
}

async function getAuthenticatedUserTeamSlugsForOrg(
	context: GitHubContext,
	org: string,
) {
	const teamSlugs = new Set<string>();
	let page = 1;

	while (true) {
		const response = await context.octokit.request("GET /user/teams", {
			page,
			per_page: 100,
		});
		const teams = response.data as GitHubUserTeam[];
		for (const team of teams) {
			if (loginMatches(team.organization?.login, org) && team.slug) {
				teamSlugs.add(team.slug.toLowerCase());
			}
		}

		if (teams.length < 100) {
			break;
		}

		page += 1;
	}

	return teamSlugs;
}

async function branchProtectionAllowsBypass({
	context,
	target,
	permissions,
	viewerLogin,
}: {
	context: GitHubContext;
	target: BranchTarget;
	permissions: RepositoryPermissions | undefined;
	viewerLogin: string;
}): Promise<boolean | null> {
	try {
		const response = await context.octokit.request(
			"GET /repos/{owner}/{repo}/branches/{branch}/protection",
			target,
		);
		const protection = response.data as GitHubBranchProtection;
		const allowances =
			protection.required_pull_request_reviews?.bypass_pull_request_allowances;
		const allowedUsers = allowances?.users ?? [];
		if (allowedUsers.some((user) => loginMatches(user.login, viewerLogin))) {
			return true;
		}

		const allowedTeamSlugs = (allowances?.teams ?? []).flatMap((team) =>
			team.slug ? [team.slug.toLowerCase()] : [],
		);
		if (allowedTeamSlugs.length > 0) {
			const userTeamSlugs = await getAuthenticatedUserTeamSlugsForOrg(
				context,
				target.owner,
			);
			if (allowedTeamSlugs.some((slug) => userTeamSlugs.has(slug))) {
				return true;
			}
		}

		return (
			permissions?.admin === true && protection.enforce_admins?.enabled !== true
		);
	} catch {
		return null;
	}
}

/** Classic branch protection, for branches no ruleset decides. */
export async function getBranchProtectionBypassState({
	contexts,
	target,
	permissions,
}: {
	contexts: GitHubContext[];
	target: BranchTarget;
	permissions: RepositoryPermissions | undefined;
}): Promise<boolean | null> {
	for (const context of contexts) {
		try {
			const viewer = await getViewer(context);
			const state = await branchProtectionAllowsBypass({
				context,
				target,
				permissions,
				viewerLogin: viewer.login,
			});
			if (state !== null) {
				return state;
			}
		} catch {}
	}
	return null;
}
