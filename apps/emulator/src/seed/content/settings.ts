import type { Ago } from "../types.ts";

/**
 * What the repository and organization settings pages show: access, branch
 * rules, webhooks, Actions secrets/variables and org invitations. Everything
 * lives on `lumen-labs/beacon` and the `lumen-labs` org.
 */
export const settingsContent = {
	repo: "lumen-labs/beacon",
	org: "lumen-labs",
	/** theo-martin is already a collaborator through the repo spec. */
	collaborators: [
		{ login: "jun-park", permission: "maintain" },
		{ login: "lena-fischer", permission: "triage" },
		{ login: "sam-okafor", permission: "admin" },
	] as const,
	/** Not an org member: only outsiders get invited instead of added. */
	invitedUser: {
		login: "mika-tanaka",
		name: "Mika Tanaka",
		email: "mika@tanaka.example",
		bio: "Frontend contractor, SSE and streaming UIs.",
		location: "Osaka",
	},
	repoInvitations: [
		{
			login: "mika-tanaka",
			permissions: "read",
			inviter: "nova",
			at: { d: 2, h: 5 },
		},
	] as const,
	teamRoles: [
		{ slug: "runtime", permission: "maintain" },
		{ slug: "design-systems", permission: "pull" },
	] as const,
	protection: {
		branch: "main",
		// emulate enforces classic protection when merging, so this one asks for
		// a pull request but no approvals or checks: seeded PRs stay mergeable.
		// The ruleset below carries the strict requirements for display.
		required_status_checks: { strict: true, contexts: [] as string[] },
		required_pull_request_reviews: {
			required_approving_review_count: 0,
			dismiss_stale_reviews: true,
			require_code_owner_reviews: false,
		},
		enforce_admins: false,
		required_signatures: false,
		required_linear_history: true,
		allow_force_pushes: false,
		allow_deletions: false,
		required_conversation_resolution: true,
		lock_branch: false,
		at: { d: 200 },
	},
	rulesets: [
		{
			name: "Protect the default branch",
			target: "branch" as const,
			enforcement: "active" as const,
			include: ["~DEFAULT_BRANCH"],
			exclude: [],
			rules: [
				{ type: "deletion" },
				{ type: "non_fast_forward" },
				{
					type: "pull_request",
					parameters: {
						required_approving_review_count: 2,
						dismiss_stale_reviews_on_push: true,
						require_code_owner_review: false,
						require_last_push_approval: false,
						required_review_thread_resolution: true,
					},
				},
				{
					type: "required_status_checks",
					parameters: {
						strict_required_status_checks_policy: true,
						required_status_checks: [
							{ context: "lint" },
							{ context: "test (22)" },
						],
					},
				},
			],
			bypass_actors: [
				{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
			],
			at: { d: 120 },
			updated: { d: 30 },
		},
		{
			name: "Release tags",
			target: "tag" as const,
			enforcement: "evaluate" as const,
			include: ["refs/tags/v*"],
			exclude: [],
			rules: [{ type: "deletion" }, { type: "update" }],
			bypass_actors: [],
			at: { d: 45 },
			updated: { d: 45 },
		},
	],
	secrets: [
		{ name: "NPM_TOKEN", at: { d: 160 } },
		{ name: "CLOUDFLARE_API_TOKEN", at: { d: 90 } },
		{ name: "SENTRY_AUTH_TOKEN", at: { d: 12 } },
	],
	variables: [
		{ name: "NODE_VERSION", value: "22", at: { d: 160 } },
		{ name: "DEPLOY_REGION", value: "weur", at: { d: 90 } },
		{ name: "TURBO_TEAM", value: "lumen-labs", at: { d: 30 } },
	],
	hooks: [
		{
			url: "https://hooks.lumen-labs.example/github/beacon",
			events: ["push", "pull_request", "issues"],
			secret: "demo-webhook-secret",
			at: { d: 150 },
			lastResponse: { code: 200, status: "active", message: "OK" },
			deliveries: [
				{
					event: "push",
					action: null,
					at: { d: 0, h: 20 },
					code: 200,
					ms: 0.31,
				},
				{
					event: "pull_request",
					action: "opened",
					at: { d: 1, h: 4 },
					code: 200,
					ms: 0.42,
				},
				{
					event: "pull_request",
					action: "closed",
					at: { d: 1, h: 9 },
					code: 200,
					ms: 0.38,
				},
				{
					event: "issues",
					action: "opened",
					at: { d: 2, h: 3 },
					code: 200,
					ms: 0.27,
				},
				{
					event: "push",
					action: null,
					at: { d: 3, h: 12 },
					code: 200,
					ms: 0.29,
				},
				{ event: "ping", action: null, at: { d: 150 }, code: 200, ms: 0.18 },
			],
		},
		{
			url: "https://ci.lumen-labs.example/webhooks/beacon",
			events: ["push", "release"],
			secret: null,
			at: { d: 70 },
			lastResponse: {
				code: 500,
				status: "misconfigured",
				message: "Invalid HTTP Response: 500",
			},
			deliveries: [
				{
					event: "push",
					action: null,
					at: { d: 0, h: 20 },
					code: 500,
					ms: 1.84,
				},
				{
					event: "release",
					action: "published",
					at: { d: 1, h: 2 },
					code: 500,
					ms: 1.62,
				},
				{
					event: "push",
					action: null,
					at: { d: 3, h: 12 },
					code: 500,
					ms: 2.05,
				},
				{
					event: "push",
					action: null,
					at: { d: 4, h: 8 },
					code: 500,
					ms: 1.77,
				},
				{
					event: "push",
					action: null,
					at: { d: 9, h: 6 },
					code: 200,
					ms: 0.51,
				},
				{ event: "ping", action: null, at: { d: 70 }, code: 200, ms: 0.22 },
			],
		},
	] as ReadonlyArray<{
		url: string;
		events: string[];
		secret: string | null;
		at: Ago;
		lastResponse: { code: number; status: string; message: string };
		deliveries: ReadonlyArray<{
			event: string;
			action: string | null;
			at: Ago;
			code: number;
			ms: number;
		}>;
	}>,
	orgInvitations: [
		{
			email: "casey@partner.example",
			role: "direct_member",
			inviter: "nova",
			at: { d: 3, h: 2 },
		},
	] as const,
};
