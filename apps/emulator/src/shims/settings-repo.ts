/**
 * Repository settings: the repository itself, classic branch protection and
 * rulesets. emulate answers most of this; these shims add what it drops
 * (`allow_update_branch`, per-viewer `permissions`, protection flags, rulesets)
 * and clean up the data it leaves behind when a repository is deleted.
 */
import type { GitHubBranchProtection, GitHubRepo } from "@emulators/github";
import type { ShimContext } from "../server.ts";
import type { ProtectionFlagsRow, RulesetRow } from "../store-settings.ts";
import {
	GITHUB_WEB_URL,
	getAuthUser,
	getViewer,
	type ShimRequestContext,
	stores,
} from "./common.ts";
import { encodeNodeId } from "./enrich.ts";
import {
	fail,
	guardRepo,
	invalidField,
	isResponse,
	pageWithLinks,
	passThrough,
	permissionFlags,
	readBody,
	settingsStores,
	userRepoLevel,
	wrap,
} from "./settings-common.ts";

const VISIBILITIES = ["public", "private", "internal"];

function flagValue(value: unknown) {
	if (typeof value === "boolean") {
		return value;
	}
	if (value && typeof value === "object" && "enabled" in value) {
		return Boolean(value.enabled);
	}
	return false;
}

export function registerRepoSettingsShims(context: ShimContext) {
	const { app, baseUrl } = context;

	type RepoJson = GitHubRepo & { permissions: unknown };

	const decorateRepo = (c: ShimRequestContext, repoJson: RepoJson) => {
		const { gh, settings } = settingsStores(context);
		const repo = gh.repos.get(repoJson.id);
		if (!repo) {
			return repoJson;
		}
		const viewer = getViewer(gh, c);
		return {
			...repoJson,
			allow_update_branch:
				settings.repoFlags.findOneBy("repo_id", repo.id)?.allow_update_branch ??
				false,
			permissions:
				viewer || !getAuthUser(c)
					? permissionFlags(viewer ? userRepoLevel(gh, viewer, repo) : "pull")
					: repoJson.permissions,
		};
	};

	wrap(context, "GET", "/repos/:owner/:repo", async (c, next) => {
		await passThrough<RepoJson>(c, next, (repo) => decorateRepo(c, repo));
		return undefined;
	});

	wrap(context, "PATCH", "/repos/:owner/:repo", async (c, next) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const { gh, settings } = settingsStores(context);
		const body = await readBody(c);
		if (
			typeof body.default_branch === "string" &&
			!gh.branches
				.findBy("repo_id", repo.id)
				.some((branch) => branch.name === body.default_branch)
		) {
			return invalidField(c, "Repository", "default_branch");
		}
		if (
			"visibility" in body &&
			!VISIBILITIES.includes(String(body.visibility))
		) {
			return invalidField(c, "Repository", "visibility");
		}
		await passThrough<RepoJson>(c, next, (updated) => {
			if (typeof body.allow_update_branch === "boolean") {
				const flags = settings.repoFlags.findOneBy("repo_id", repo.id);
				if (flags) {
					settings.repoFlags.update(flags.id, {
						allow_update_branch: body.allow_update_branch,
					});
				} else {
					settings.repoFlags.insert({
						repo_id: repo.id,
						allow_update_branch: body.allow_update_branch,
					});
				}
			}
			return decorateRepo(c, updated);
		});
		return undefined;
	});

	wrap(context, "DELETE", "/repos/:owner/:repo", async (c, next) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const refs = collectRepoRefs(context, repo.id);
		await passThrough(c, next);
		purgeRepoData(context, repo.id, refs);
		return undefined;
	});

	const protectionJson = (
		repo: GitHubRepo,
		protection: GitHubBranchProtection,
		flags: ProtectionFlagsRow | undefined,
	) => {
		const base = `${baseUrl}/repos/${repo.full_name}/branches/${encodeURIComponent(protection.branch_name)}/protection`;
		const checks = protection.required_status_checks;
		const reviews = protection.required_pull_request_reviews;
		return {
			url: base,
			required_status_checks: checks
				? {
						url: `${base}/required_status_checks`,
						strict: checks.strict,
						contexts: checks.contexts,
						contexts_url: `${base}/required_status_checks/contexts`,
						checks: checks.contexts.map((name) => ({
							context: name,
							app_id: null,
						})),
					}
				: null,
			enforce_admins: {
				url: `${base}/enforce_admins`,
				enabled: protection.enforce_admins,
			},
			required_pull_request_reviews: reviews
				? {
						url: `${base}/required_pull_request_reviews`,
						dismiss_stale_reviews: reviews.dismiss_stale_reviews,
						require_code_owner_reviews: reviews.require_code_owner_reviews,
						require_last_push_approval: false,
						required_approving_review_count:
							reviews.required_approving_review_count,
					}
				: null,
			restrictions: protection.restrictions
				? {
						url: `${base}/restrictions`,
						users_url: `${base}/restrictions/users`,
						teams_url: `${base}/restrictions/teams`,
						apps_url: `${base}/restrictions/apps`,
						users: protection.restrictions.users.map((login) => ({ login })),
						teams: protection.restrictions.teams.map((slug) => ({ slug })),
						apps: [],
					}
				: null,
			required_signatures: {
				url: `${base}/required_signatures`,
				enabled: protection.required_signatures,
			},
			required_linear_history: { enabled: protection.required_linear_history },
			allow_force_pushes: { enabled: protection.allow_force_pushes },
			allow_deletions: { enabled: protection.allow_deletions },
			block_creations: { enabled: false },
			required_conversation_resolution: {
				enabled: flags?.required_conversation_resolution ?? false,
			},
			lock_branch: { enabled: flags?.lock_branch ?? false },
			allow_fork_syncing: { enabled: false },
		};
	};

	const findProtection = (repoId: number, branch: string) => {
		const { gh, settings } = settingsStores(context);
		return {
			protection: gh.branchProtections
				.findBy("repo_id", repoId)
				.find((row) => row.branch_name === branch),
			flags: settings.protectionFlags
				.findBy("repo_id", repoId)
				.find((row) => row.branch_name === branch),
		};
	};

	app.get("/repos/:owner/:repo/branches/:branch{.+}/protection", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const { protection, flags } = findProtection(
			repo.id,
			c.req.param("branch"),
		);
		if (!protection) {
			const exists = settingsStores(context)
				.gh.branches.findBy("repo_id", repo.id)
				.some((row) => row.name === c.req.param("branch"));
			return fail(c, 404, exists ? "Branch not protected" : "Branch not found");
		}
		return c.json(protectionJson(repo, protection, flags));
	});

	wrap(
		context,
		"PUT",
		"/repos/:owner/:repo/branches/:branch{.+}/protection",
		async (c, next) => {
			const repo = guardRepo(context, c, "admin");
			if (isResponse(repo)) {
				return repo;
			}
			const body = await readBody(c);
			const branch = c.req.param("branch");
			await passThrough(c, next, () => {
				const { settings } = settingsStores(context);
				const { protection, flags } = findProtection(repo.id, branch);
				const nextFlags = {
					required_conversation_resolution: flagValue(
						body.required_conversation_resolution,
					),
					lock_branch: flagValue(body.lock_branch),
				};
				const saved = flags
					? settings.protectionFlags.update(flags.id, nextFlags)
					: settings.protectionFlags.insert({
							repo_id: repo.id,
							branch_name: branch,
							...nextFlags,
						});
				return protection ? protectionJson(repo, protection, saved) : {};
			});
			return undefined;
		},
	);

	wrap(
		context,
		"DELETE",
		"/repos/:owner/:repo/branches/:branch{.+}/protection",
		async (c, next) => {
			const repo = guardRepo(context, c, "admin");
			if (isResponse(repo)) {
				return repo;
			}
			await passThrough(c, next);
			const { flags } = findProtection(repo.id, c.req.param("branch"));
			if (flags) {
				settingsStores(context).settings.protectionFlags.delete(flags.id);
			}
			return undefined;
		},
	);

	const rulesetSummary = (repo: GitHubRepo, row: RulesetRow) => ({
		id: row.id,
		name: row.name,
		target: row.target,
		source_type: "Repository",
		source: repo.full_name,
		enforcement: row.enforcement,
		node_id: encodeNodeId("Ruleset", row.id),
		_links: {
			self: { href: `${baseUrl}/repos/${repo.full_name}/rulesets/${row.id}` },
			html: { href: `${GITHUB_WEB_URL}/${repo.full_name}/rules/${row.id}` },
		},
		created_at: row.created_at,
		updated_at: row.updated_at,
	});

	app.get("/repos/:owner/:repo/rulesets", (c) => {
		const repo = guardRepo(context, c);
		if (isResponse(repo)) {
			return repo;
		}
		const rows = settingsStores(context)
			.settings.rulesets.findBy("repo_id", repo.id)
			.sort((a, b) => a.id - b.id);
		return c.json(
			pageWithLinks(c, rows).map((row) => rulesetSummary(repo, row)),
		);
	});

	app.get("/repos/:owner/:repo/rulesets/:id", (c) => {
		const repo = guardRepo(context, c);
		if (isResponse(repo)) {
			return repo;
		}
		const row = settingsStores(context).settings.rulesets.get(
			Number(c.req.param("id")),
		);
		if (!row || row.repo_id !== repo.id) {
			return fail(c, 404, "Not Found");
		}
		return c.json({
			...rulesetSummary(repo, row),
			current_user_can_bypass: "always",
			conditions: row.conditions,
			rules: row.rules,
			bypass_actors: row.bypass_actors,
		});
	});

	app.get("/repos/:owner/:repo/rules/branches/:branch{.+}", (c) => {
		const repo = guardRepo(context, c);
		if (isResponse(repo)) {
			return repo;
		}
		const branch = c.req.param("branch");
		const rules = settingsStores(context)
			.settings.rulesets.findBy("repo_id", repo.id)
			.sort((a, b) => a.id - b.id)
			.filter(
				(row) =>
					row.target === "branch" &&
					row.enforcement === "active" &&
					appliesToBranch(row, branch, repo.default_branch),
			)
			.flatMap((row) =>
				row.rules.map((rule) => ({
					...rule,
					ruleset_source_type: "Repository",
					ruleset_source: repo.full_name,
					ruleset_id: row.id,
				})),
			);
		return c.json(rules);
	});
}

function refMatches(pattern: string, branch: string, defaultBranch: string) {
	if (pattern === "~ALL") {
		return true;
	}
	if (pattern === "~DEFAULT_BRANCH") {
		return branch === defaultBranch;
	}
	const source = pattern.replace(/\*\*|\*|\?|[.+^${}()|[\]\\]/gu, (token) => {
		if (token === "**") return ".*";
		if (token === "*") return "[^/]*";
		if (token === "?") return "[^/]";
		return `\\${token}`;
	});
	return new RegExp(`^${source}$`, "u").test(`refs/heads/${branch}`);
}

function appliesToBranch(
	row: RulesetRow,
	branch: string,
	defaultBranch: string,
) {
	const { include, exclude } = row.conditions.ref_name;
	return (
		include.some((pattern) => refMatches(pattern, branch, defaultBranch)) &&
		!exclude.some((pattern) => refMatches(pattern, branch, defaultBranch))
	);
}

/** Ids that point at a repository through rows keyed by something else. */
function collectRepoRefs(context: ShimContext, repoId: number) {
	const { gh } = stores(context);
	return {
		hookIds: gh.webhooks.findBy("repo_id", repoId).map((hook) => hook.id),
		jobIds: gh.workflowRuns
			.findBy("repo_id", repoId)
			.flatMap((run) => gh.jobs.findBy("run_id", run.id).map((job) => job.id)),
		subjectIds: new Set([
			...gh.issues.findBy("repo_id", repoId).map((issue) => issue.id),
			...gh.comments.findBy("repo_id", repoId).map((comment) => comment.id),
		]),
	};
}

/** emulate's cascade stops at its own collections; clear the rest. */
function purgeRepoData(
	context: ShimContext,
	repoId: number,
	refs: ReturnType<typeof collectRepoRefs>,
) {
	const { gh, extras } = stores(context);
	const { settings } = settingsStores(context);
	const drop = <T extends { id: number }>(
		collection: { delete: (id: number) => boolean },
		rows: T[],
	) => {
		for (const row of rows) {
			collection.delete(row.id);
		}
	};

	for (const hookId of refs.hookIds) {
		context.webhooks.unregister(hookId);
		drop(
			settings.hookDeliveries,
			settings.hookDeliveries.findBy("hook_id", hookId),
		);
	}
	for (const jobId of refs.jobIds) {
		drop(extras.jobLogs, extras.jobLogs.findBy("job_id", jobId));
	}
	for (const id of refs.subjectIds) {
		drop(extras.reactions, extras.reactions.findBy("subject_id", id));
		drop(
			extras.threadStates,
			extras.threadStates.findBy("root_comment_id", id),
		);
		drop(extras.commentRanges, extras.commentRanges.findBy("comment_id", id));
		drop(extras.minimized, extras.minimized.findBy("comment_id", id));
	}
	drop(extras.statuses, extras.statuses.findBy("repo_id", repoId));
	drop(extras.discussions, extras.discussions.findBy("repo_id", repoId));
	drop(extras.stars, extras.stars.findBy("repo_id", repoId));
	drop(
		extras.notifications,
		extras.notifications.all().filter((row) => row.repo_id === repoId),
	);
	for (const pin of extras.pinned.all()) {
		if (pin.repo_ids.includes(repoId)) {
			extras.pinned.update(pin.id, {
				repo_ids: pin.repo_ids.filter((id) => id !== repoId),
			});
		}
	}
	for (const link of gh.teamRepos.findBy("repo_id", repoId)) {
		gh.teamRepos.delete(link.id);
		gh.teams.update(link.team_id, {
			repos_count: gh.teamRepos.findBy("team_id", link.team_id).length,
		});
	}
	drop(
		settings.teamRepoRoles,
		settings.teamRepoRoles.findBy("repo_id", repoId),
	);
	drop(settings.repoFlags, settings.repoFlags.findBy("repo_id", repoId));
	drop(settings.variables, settings.variables.findBy("repo_id", repoId));
	drop(
		settings.repoInvitations,
		settings.repoInvitations.findBy("repo_id", repoId),
	);
	drop(settings.rulesets, settings.rulesets.findBy("repo_id", repoId));
	drop(
		settings.protectionFlags,
		settings.protectionFlags.findBy("repo_id", repoId),
	);
}
