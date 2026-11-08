import { describe, expect, it } from "vitest";
import {
	describeRule,
	formatRefPattern,
	mapBranchProtection,
	mapRuleset,
} from "./rules";

describe("describeRule", () => {
	it("counts approvals and required checks", () => {
		expect(
			describeRule({
				type: "pull_request",
				parameters: { required_approving_review_count: 2 },
			}),
		).toBe("Require a pull request (2 approvals)");
		expect(
			describeRule({
				type: "pull_request",
				parameters: { required_approving_review_count: 1 },
			}),
		).toBe("Require a pull request (1 approval)");
		expect(
			describeRule({
				type: "required_status_checks",
				parameters: { required_status_checks: [{ context: "ci" }] },
			}),
		).toBe("Require status checks (1)");
	});

	it("humanizes rule types GitHub adds later", () => {
		expect(describeRule({ type: "some_new_rule" })).toBe("Some new rule");
	});
});

describe("mapRuleset", () => {
	it("flattens the detail payload and marks organization rulesets inherited", () => {
		const ruleset = mapRuleset(
			{
				id: 7,
				name: "Protect main",
				target: "branch",
				source_type: "Organization",
				enforcement: "evaluate",
				_links: { html: { href: "https://github.com/acme/api/rules/7" } },
			},
			{
				conditions: {
					ref_name: {
						include: ["~DEFAULT_BRANCH"],
						exclude: ["refs/heads/wip"],
					},
				},
				rules: [{ type: "deletion" }, { type: "non_fast_forward" }],
				bypass_actors: [{}, {}],
			},
		);
		expect(ruleset).toMatchObject({
			inherited: true,
			enforcement: "evaluate",
			includes: ["Default branch"],
			excludes: ["wip"],
			rules: ["Restrict deletions", "Block force pushes"],
			bypassActorCount: 2,
			htmlUrl: "https://github.com/acme/api/rules/7",
		});
	});

	it("treats an unknown enforcement as disabled and a missing detail as no rules", () => {
		const ruleset = mapRuleset(
			{ id: 1, name: "x", enforcement: "paused" },
			null,
		);
		expect(ruleset.enforcement).toBe("disabled");
		expect(ruleset.rules).toEqual([]);
		expect(ruleset.target).toBe("branch");
	});
});

describe("formatRefPattern", () => {
	it("strips the ref prefix and names the special patterns", () => {
		expect(formatRefPattern("refs/heads/release/*")).toBe("release/*");
		expect(formatRefPattern("refs/tags/v*")).toBe("v*");
		expect(formatRefPattern("~ALL")).toBe("All branches and tags");
	});
});

describe("mapBranchProtection", () => {
	it("lists the protections in force, including what is blocked by default", () => {
		const { rules } = mapBranchProtection("main", {
			required_pull_request_reviews: {
				required_approving_review_count: 2,
				dismiss_stale_reviews: true,
			},
			required_status_checks: {
				strict: true,
				contexts: ["ci"],
				checks: [{ context: "ci" }, { context: "lint" }],
			},
			enforce_admins: { enabled: true },
			allow_force_pushes: { enabled: false },
		});
		expect(rules).toEqual([
			"Require a pull request (2 approvals)",
			"Dismiss stale approvals",
			"Require status checks (ci, lint)",
			"Require up-to-date",
			"Block force pushes",
			"Block deletions",
			"Include administrators",
		]);
	});

	it("omits the block rules when force pushes and deletions are allowed", () => {
		const { rules } = mapBranchProtection("dev", {
			allow_force_pushes: { enabled: true },
			allow_deletions: { enabled: true },
		});
		expect(rules).toEqual([]);
	});
});
