/**
 * REST endpoints DiffKit calls that emulate 0.13 does not serve (or serves in
 * a shape DiffKit cannot use). Registered before emulate's routes.
 */
import type { GitHubAppInstallation, GitHubComment } from "@emulators/github";
import { zipSync } from "fflate";
import { commitsBetween } from "../graphql/git.ts";
import { DEMO_GITHUB_APP } from "../seed/identity.ts";
import type { ShimContext } from "../server.ts";
import type { CommitStatusRow } from "../store-extras.ts";
import {
	apiRepoJson,
	apiUserJson,
	canReadRepo,
	findRepo,
	GITHUB_WEB_URL,
	getAuthUser,
	getViewer,
	hashString,
	isOrgMember,
	json,
	notFound,
	ownerLogin,
	paginate,
	parseIntParam,
	requiresAuth,
	type ShimRequestContext,
	stores,
} from "./common.ts";
import { buildUserEvents } from "./events.ts";
import { registerSearchRoute } from "./search.ts";

const AVATAR_COLORS = [
	"#0f766e",
	"#7c3aed",
	"#b45309",
	"#be123c",
	"#1d4ed8",
	"#15803d",
	"#a21caf",
	"#334155",
];

function avatarSvg(login: string) {
	const color = AVATAR_COLORS[hashString(login) % AVATAR_COLORS.length];
	const initials =
		login
			.split(/[-_]/u)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "?";
	return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="${color}"/><text x="64" y="64" dy=".35em" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="52" font-weight="600" fill="#fff">${initials}</text></svg>`;
}

function formatInstallation(
	context: ShimContext,
	installation: GitHubAppInstallation,
) {
	const { gh } = stores(context);
	const app = gh.apps.all().find((row) => row.app_id === installation.app_id);
	const isOrg = installation.account_type === "Organization";
	const account = isOrg
		? gh.orgs.get(installation.account_id)
		: gh.users.get(installation.account_id);
	const login = account?.login ?? installation.account_login;
	return {
		id: installation.installation_id,
		account: {
			login,
			id: installation.account_id,
			node_id: account?.node_id ?? "",
			avatar_url: `${context.baseUrl}/avatars/u/${login}`,
			html_url: `${GITHUB_WEB_URL}/${login}`,
			type: installation.account_type,
			site_admin: false,
		},
		repository_selection: installation.repository_selection,
		access_tokens_url: `${context.baseUrl}/app/installations/${installation.installation_id}/access_tokens`,
		repositories_url: `${context.baseUrl}/installation/repositories`,
		html_url: isOrg
			? `${GITHUB_WEB_URL}/organizations/${login}/settings/installations/${installation.installation_id}`
			: `${GITHUB_WEB_URL}/settings/installations/${installation.installation_id}`,
		app_id: installation.app_id,
		app_slug: app?.slug ?? "",
		target_id: installation.account_id,
		target_type: installation.account_type,
		permissions: installation.permissions,
		events: installation.events,
		created_at: installation.created_at,
		updated_at: installation.updated_at,
		single_file_name: null,
		suspended_at: installation.suspended_at,
		suspended_by: null,
	};
}

function installationsVisibleTo(context: ShimContext, userId: number) {
	const { gh } = stores(context);
	return gh.appInstallations.all().filter((installation) => {
		if (installation.account_type === "User") {
			return installation.account_id === userId;
		}
		return isOrgMember(gh, installation.account_id, userId);
	});
}

function reposForInstallation(
	context: ShimContext,
	installation: GitHubAppInstallation,
) {
	const { gh } = stores(context);
	return gh.repos
		.all()
		.filter(
			(repo) =>
				repo.owner_id === installation.account_id &&
				repo.owner_type === installation.account_type &&
				(installation.repository_selection === "all" ||
					installation.repository_ids.includes(repo.id)),
		)
		.sort((a, b) => a.id - b.id);
}

function resolveCommitSha(context: ShimContext, repoId: number, ref: string) {
	const { gh } = stores(context);
	const branch = gh.branches
		.findBy("repo_id", repoId)
		.find((row) => row.name === ref.replace(/^refs\/heads\//u, ""));
	if (branch) {
		return branch.sha;
	}
	const tag = gh.refs
		.findBy("repo_id", repoId)
		.find(
			(row) => row.ref === `refs/tags/${ref.replace(/^refs\/tags\//u, "")}`,
		);
	if (tag) {
		const annotated = gh.tags
			.findBy("repo_id", repoId)
			.find((row) => row.sha === tag.sha);
		return annotated?.object_sha ?? tag.sha;
	}
	const commit = gh.commits
		.findBy("repo_id", repoId)
		.find(
			(row) => row.sha === ref || (ref.length >= 7 && row.sha.startsWith(ref)),
		);
	return commit?.sha ?? null;
}

function statusJson(context: ShimContext, row: CommitStatusRow) {
	const { gh } = stores(context);
	const creator = gh.users.get(row.creator_id);
	return {
		url: `${context.baseUrl}/repos/statuses/${row.sha}`,
		avatar_url: creator
			? `${context.baseUrl}/avatars/u/${creator.login}`
			: null,
		id: row.id,
		node_id: Buffer.from(`0:StatusContext${row.id}`).toString("base64"),
		state: row.state,
		description: row.description,
		target_url: row.target_url,
		context: row.context,
		created_at: row.created_at,
		updated_at: row.updated_at,
		creator: creator ? apiUserJson(creator, context.baseUrl) : null,
	};
}

const STATE_RANK = { error: 3, failure: 2, pending: 1, success: 0 } as const;

function latestStatuses(context: ShimContext, repoId: number, sha: string) {
	const { extras } = stores(context);
	const byContext = new Map<string, CommitStatusRow>();
	for (const row of extras.statuses.findBy("sha", sha)) {
		if (row.repo_id !== repoId) {
			continue;
		}
		const existing = byContext.get(row.context);
		if (!existing || row.id > existing.id) {
			byContext.set(row.context, row);
		}
	}
	return [...byContext.values()].sort((a, b) => b.id - a.id);
}

/** Builds a GitHub-style logs archive: `<n>_<job>.txt` + `<job>/<step>_<name>.txt`. */
export function buildRunLogsZip(context: ShimContext, runId: number) {
	const { gh, extras } = stores(context);
	const files: Record<string, Uint8Array> = {};
	const encoder = new TextEncoder();
	const jobs = gh.jobs.findBy("run_id", runId).sort((a, b) => a.id - b.id);
	jobs.forEach((job, index) => {
		const jobName = job.name.replace(/[/:]/gu, "").slice(0, 90).trim();
		const logs = extras.jobLogs.findOneBy("job_id", job.id);
		const combined: string[] = [];
		for (const step of job.steps) {
			const lines = logs?.steps[String(step.number)] ?? [
				`${step.started_at ?? job.started_at ?? ""} ${step.name}`,
			];
			combined.push(...lines);
			const stepName = step.name.replace(/[/:]/gu, "");
			files[`${jobName}/${step.number}_${stepName}.txt`] = encoder.encode(
				`${lines.join("\n")}\n`,
			);
		}
		files[`${index}_${jobName}.txt`] = encoder.encode(
			`${combined.join("\n")}\n`,
		);
	});
	return zipSync(files, { level: 6 });
}

function jobLogText(context: ShimContext, jobId: number) {
	const { gh, extras } = stores(context);
	const job = gh.jobs.get(jobId);
	if (!job) {
		return null;
	}
	const logs = extras.jobLogs.findOneBy("job_id", job.id);
	const lines: string[] = [];
	for (const step of job.steps) {
		lines.push(...(logs?.steps[String(step.number)] ?? []));
	}
	return `${lines.join("\n")}\n`;
}

/** Sunday-aligned weekly commit counts for the past 52 weeks. */
function participation(context: ShimContext, repoId: number, ownerId: number) {
	const { gh } = stores(context);
	const now = Date.now();
	const weekMs = 7 * 24 * 60 * 60 * 1000;
	const all = new Array<number>(52).fill(0);
	const owner = new Array<number>(52).fill(0);
	for (const commit of gh.commits.findBy("repo_id", repoId)) {
		const age = now - Date.parse(commit.committer_date);
		const bucket = 51 - Math.floor(age / weekMs);
		if (bucket < 0 || bucket > 51) {
			continue;
		}
		all[bucket] += 1;
		if (commit.user_id === ownerId) {
			owner[bucket] += 1;
		}
	}
	return { all, owner };
}

function assertRepo(
	context: ShimContext,
	c: ShimRequestContext,
): ReturnType<typeof findRepo> | null {
	const { gh } = stores(context);
	const repo = findRepo(gh, c.req.param("owner"), c.req.param("repo"));
	if (!repo || !canReadRepo(gh, getAuthUser(c), repo)) {
		return null;
	}
	return repo;
}

async function readJson(c: ShimRequestContext) {
	try {
		return (await c.req.json()) as Record<string, unknown>;
	} catch {
		return {};
	}
}

export function registerRestShims(context: ShimContext) {
	const { app, baseUrl } = context;

	registerSearchRoute(context);

	app.get("/_diffkit/health", (c) =>
		json(c, {
			ok: true,
			ready: Boolean(context.store.getData("diffkit.ready")),
		}),
	);

	// Demo mode only: the dashboard fetches the demo App's key from here so no
	// private key has to be committed to .dev.vars.demo.
	app.get("/_diffkit/demo-app-private-key", (c) => {
		const { gh } = stores(context);
		const app = gh.apps
			.all()
			.find((row) => row.app_id === DEMO_GITHUB_APP.appId);
		return app
			? c.text(app.private_key, 200, { "Cache-Control": "no-store" })
			: notFound(c);
	});

	app.get("/avatars/u/:login", (c) =>
		c.body(avatarSvg(c.req.param("login")), 200, {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "public, max-age=86400",
		}),
	);

	// --- App installations visible to the user (app-user token) -----------
	app.get("/user/installations", (c) => {
		const { gh } = stores(context);
		const viewer = getViewer(gh, c);
		if (!viewer) {
			return requiresAuth(c);
		}
		const installations = installationsVisibleTo(context, viewer.id);
		return json(c, {
			total_count: installations.length,
			installations: paginate(c, installations).map((row) =>
				formatInstallation(context, row),
			),
		});
	});

	app.get("/user/installations/:installation_id/repositories", (c) => {
		const { gh } = stores(context);
		const viewer = getViewer(gh, c);
		if (!viewer) {
			return requiresAuth(c);
		}
		const installationId = parseIntParam(c.req.param("installation_id"));
		const installation = installationsVisibleTo(context, viewer.id).find(
			(row) => row.installation_id === installationId,
		);
		if (!installation) {
			return notFound(c);
		}
		const repos = reposForInstallation(context, installation);
		return json(c, {
			total_count: repos.length,
			repository_selection: installation.repository_selection,
			repositories: paginate(c, repos).map((repo) =>
				apiRepoJson(gh, repo, baseUrl),
			),
		});
	});

	app.get("/orgs/:org/installations", (c) => {
		const { gh } = stores(context);
		const org = gh.orgs.findOneBy("login", c.req.param("org"));
		if (!org) {
			return notFound(c);
		}
		const installations = gh.appInstallations
			.all()
			.filter(
				(row) =>
					row.account_type === "Organization" && row.account_id === org.id,
			);
		return json(c, {
			total_count: installations.length,
			installations: installations.map((row) =>
				formatInstallation(context, row),
			),
		});
	});

	app.get("/user/teams", (c) => {
		const { gh } = stores(context);
		const viewer = getViewer(gh, c);
		if (!viewer) {
			return requiresAuth(c);
		}
		const teams = gh.teams
			.all()
			.filter((team) =>
				gh.teamMembers
					.findBy("team_id", team.id)
					.some((member) => member.user_id === viewer.id),
			);
		return json(
			c,
			paginate(c, teams).map((team) => {
				const org = gh.orgs.get(team.org_id);
				return {
					id: team.id,
					node_id: team.node_id,
					name: team.name,
					slug: team.slug,
					description: team.description,
					privacy: team.privacy,
					permission: team.permission,
					html_url: `${GITHUB_WEB_URL}/orgs/${org?.login}/teams/${team.slug}`,
					organization: org
						? {
								login: org.login,
								id: org.id,
								avatar_url: `${baseUrl}/avatars/u/${org.login}`,
							}
						: null,
				};
			}),
		);
	});

	// --- Commit statuses ---------------------------------------------------
	app.post("/repos/:owner/:repo/statuses/:sha", async (c) => {
		const { gh, extras } = stores(context);
		const repo = assertRepo(context, c);
		const auth = getAuthUser(c);
		if (!repo || !auth) {
			return notFound(c);
		}
		const body = await readJson(c);
		const state = String(body.state ?? "");
		if (!["success", "failure", "pending", "error"].includes(state)) {
			return c.json({ message: "Validation Failed" }, 422);
		}
		const creator =
			gh.users.findOneBy("login", auth.login) ?? gh.users.all()[0];
		const row = extras.statuses.insert({
			repo_id: repo.id,
			sha: c.req.param("sha"),
			context: typeof body.context === "string" ? body.context : "default",
			state: state as "success",
			description:
				typeof body.description === "string" ? body.description : null,
			target_url: typeof body.target_url === "string" ? body.target_url : null,
			creator_id: creator?.id ?? 0,
		});
		context.webhooks.dispatch(
			"status",
			undefined,
			{
				sha: row.sha,
				state: row.state,
				context: row.context,
				repository: apiRepoJson(gh, repo, baseUrl),
			},
			ownerLogin(gh, repo),
			repo.name,
		);
		return json(c, statusJson(context, row), 201);
	});

	const combinedStatus = (c: ShimRequestContext) => {
		const { gh } = stores(context);
		const repo = assertRepo(context, c);
		if (!repo) {
			return notFound(c);
		}
		const sha = resolveCommitSha(context, repo.id, c.req.param("ref"));
		if (!sha) {
			return notFound(c);
		}
		const statuses = latestStatuses(context, repo.id, sha);
		let state: keyof typeof STATE_RANK = "success";
		if (statuses.length === 0) {
			state = "pending";
		}
		for (const status of statuses) {
			if (STATE_RANK[status.state] > STATE_RANK[state]) {
				state = status.state;
			}
		}
		return json(c, {
			state,
			sha,
			total_count: statuses.length,
			statuses: paginate(c, statuses, 100).map((row) =>
				statusJson(context, row),
			),
			repository: apiRepoJson(gh, repo, baseUrl),
			commit_url: `${baseUrl}/repos/${repo.full_name}/commits/${sha}`,
			url: `${baseUrl}/repos/${repo.full_name}/commits/${sha}/status`,
		});
	};
	app.get("/repos/:owner/:repo/commits/:ref{.+}/status", combinedStatus);

	app.get("/repos/:owner/:repo/commits/:ref{.+}/statuses", (c) => {
		const { extras } = stores(context);
		const repo = assertRepo(context, c);
		if (!repo) {
			return notFound(c);
		}
		const sha = resolveCommitSha(context, repo.id, c.req.param("ref"));
		const rows = extras.statuses
			.findBy("sha", sha ?? "")
			.filter((row) => row.repo_id === repo.id)
			.sort((a, b) => b.id - a.id);
		return json(
			c,
			paginate(c, rows).map((row) => statusJson(context, row)),
		);
	});

	// --- Stars ---------------------------------------------------------------
	const starTarget = (c: ShimRequestContext) => {
		const { gh } = stores(context);
		const viewer = getViewer(gh, c);
		const repo = findRepo(gh, c.req.param("owner"), c.req.param("repo"));
		return { viewer, repo };
	};

	app.get("/user/starred/:owner/:repo", (c) => {
		const { extras } = stores(context);
		const { viewer, repo } = starTarget(c);
		if (!viewer) {
			return requiresAuth(c);
		}
		const starred =
			repo &&
			extras.stars
				.findBy("user_id", viewer.id)
				.some((row) => row.repo_id === repo.id);
		return starred ? c.body(null, 204) : notFound(c);
	});

	app.put("/user/starred/:owner/:repo", (c) => {
		const { gh, extras } = stores(context);
		const { viewer, repo } = starTarget(c);
		if (!viewer) {
			return requiresAuth(c);
		}
		if (!repo) {
			return notFound(c);
		}
		const exists = extras.stars
			.findBy("user_id", viewer.id)
			.some((row) => row.repo_id === repo.id);
		if (!exists) {
			extras.stars.insert({ user_id: viewer.id, repo_id: repo.id });
			gh.repos.update(repo.id, {
				stargazers_count: repo.stargazers_count + 1,
			});
		}
		return c.body(null, 204);
	});

	app.delete("/user/starred/:owner/:repo", (c) => {
		const { gh, extras } = stores(context);
		const { viewer, repo } = starTarget(c);
		if (!viewer) {
			return requiresAuth(c);
		}
		if (!repo) {
			return notFound(c);
		}
		for (const row of extras.stars.findBy("user_id", viewer.id)) {
			if (row.repo_id === repo.id) {
				extras.stars.delete(row.id);
				gh.repos.update(repo.id, {
					stargazers_count: Math.max(0, repo.stargazers_count - 1),
				});
			}
		}
		return c.body(null, 204);
	});

	app.get("/user/starred", (c) => {
		const { gh, extras } = stores(context);
		const viewer = getViewer(gh, c);
		if (!viewer) {
			return requiresAuth(c);
		}
		const repos = extras.stars
			.findBy("user_id", viewer.id)
			.map((row) => gh.repos.get(row.repo_id))
			.filter((repo) => repo !== undefined);
		return json(
			c,
			paginate(c, repos).map((repo) => apiRepoJson(gh, repo, baseUrl)),
		);
	});

	// emulate lists collaborators; GitHub counts commit authors.
	app.get("/repos/:owner/:repo/contributors", (c) => {
		const { gh } = stores(context);
		const repo = assertRepo(context, c);
		if (!repo) {
			return notFound(c);
		}
		const counts = new Map<number, number>();
		for (const commit of gh.commits.findBy("repo_id", repo.id)) {
			if (commit.user_id && commit.parent_shas.length < 2) {
				counts.set(commit.user_id, (counts.get(commit.user_id) ?? 0) + 1);
			}
		}
		const contributors = [...counts.entries()]
			.map(([id, contributions]) => ({ user: gh.users.get(id), contributions }))
			.filter((row) => row.user !== undefined)
			.sort((a, b) => b.contributions - a.contributions)
			.map(({ user, contributions }) => ({
				...apiUserJson(user as NonNullable<typeof user>, baseUrl),
				contributions,
			}));
		return json(c, paginate(c, contributors));
	});

	// --- Repo insights -------------------------------------------------------
	app.get("/repos/:owner/:repo/stats/participation", (c) => {
		const repo = assertRepo(context, c);
		if (!repo) {
			return notFound(c);
		}
		return json(c, participation(context, repo.id, repo.owner_id));
	});

	app.get("/repos/:owner/:repo/activity", (c) => {
		const { gh } = stores(context);
		const repo = assertRepo(context, c);
		if (!repo) {
			return notFound(c);
		}
		const actorLogin = c.req.query("actor");
		const actor = actorLogin ? gh.users.findOneBy("login", actorLogin) : null;
		const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
		const activities = gh.branches
			.findBy("repo_id", repo.id)
			.filter((branch) => branch.name !== repo.default_branch)
			.flatMap((branch) => {
				const commit = gh.commits
					.findBy("repo_id", repo.id)
					.find((row) => row.sha === branch.sha);
				if (!commit || Date.parse(commit.committer_date) < dayAgo) {
					return [];
				}
				if (actor && commit.user_id !== actor.id) {
					return [];
				}
				const user = commit.user_id ? gh.users.get(commit.user_id) : null;
				return [
					{
						id: commit.id,
						node_id: commit.node_id,
						before: commit.parent_shas[0] ?? "0".repeat(40),
						after: commit.sha,
						ref: `refs/heads/${branch.name}`,
						timestamp: commit.committer_date,
						activity_type: "push",
						actor: user ? apiUserJson(user, baseUrl) : null,
					},
				];
			});
		return json(c, paginate(c, activities));
	});

	app.get("/users/:username/events", (c) =>
		json(
			c,
			paginate(c, buildUserEvents(context, c.req.param("username"), false)),
		),
	);
	app.get("/users/:username/events/public", (c) =>
		json(
			c,
			paginate(c, buildUserEvents(context, c.req.param("username"), true)),
		),
	);

	// --- Actions logs (emulate returns plain-text stubs) ----------------------
	const runLogs = (c: ShimRequestContext) => {
		const { gh } = stores(context);
		const repo = assertRepo(context, c);
		const runId = parseIntParam(c.req.param("run_id"));
		const run = runId ? gh.workflowRuns.get(runId) : undefined;
		if (!repo || !run || run.repo_id !== repo.id) {
			return notFound(c);
		}
		if (run.status !== "completed") {
			return notFound(c);
		}
		const zip = buildRunLogsZip(context, run.id);
		return c.body(new Uint8Array(zip).buffer, 200, {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename=logs_${run.id}.zip`,
		});
	};
	app.get("/repos/:owner/:repo/actions/runs/:run_id/logs", runLogs);
	app.get(
		"/repos/:owner/:repo/actions/runs/:run_id/attempts/:attempt/logs",
		runLogs,
	);

	app.get("/repos/:owner/:repo/actions/jobs/:job_id/logs", (c) => {
		const repo = assertRepo(context, c);
		const jobId = parseIntParam(c.req.param("job_id"));
		const text = repo && jobId ? jobLogText(context, jobId) : null;
		if (text === null) {
			return notFound(c);
		}
		return c.text(text, 200, { "Content-Type": "text/plain; charset=utf-8" });
	});

	app.post("/repos/:owner/:repo/actions/runs/:run_id/rerun-failed-jobs", (c) =>
		assertRepo(context, c) ? c.json({}, 201) : notFound(c),
	);
	app.post("/repos/:owner/:repo/actions/runs/:run_id/approve", (c) =>
		assertRepo(context, c) ? c.json({}, 201) : notFound(c),
	);

	// --- PR files (emulate returns placeholder names) -------------------------
	app.get("/repos/:owner/:repo/pulls/:pull_number/files", async (c) => {
		const { gh } = stores(context);
		const repo = assertRepo(context, c);
		const pullNumber = parseIntParam(c.req.param("pull_number"));
		const pull =
			repo && pullNumber
				? gh.pullRequests
						.findBy("repo_id", repo.id)
						.find((row) => row.number === pullNumber)
				: undefined;
		if (!repo || !pull) {
			return notFound(c);
		}
		const response = await context.internalFetch(
			`/repos/${repo.full_name}/compare/${pull.base_sha}...${pull.head_sha}`,
			{ headers: { Authorization: c.req.header("Authorization") ?? "" } },
		);
		if (!response.ok) {
			return json(c, []);
		}
		const comparison = (await response.json()) as { files?: unknown[] };
		const files = comparison.files ?? [];
		const perPage = Math.min(100, parseIntParam(c.req.query("per_page")) ?? 30);
		const page = Math.max(1, parseIntParam(c.req.query("page")) ?? 1);
		const lastPage = Math.max(1, Math.ceil(files.length / perPage));
		if (page < lastPage) {
			const url = new URL(c.req.url);
			url.searchParams.set("page", String(page + 1));
			const next = url.toString();
			url.searchParams.set("page", String(lastPage));
			c.header(
				"Link",
				`<${next}>; rel="next", <${url.toString()}>; rel="last"`,
			);
		}
		return json(c, paginate(c, files));
	});

	// emulate lists every ancestor of the head; GitHub lists only the PR's own.
	app.get("/repos/:owner/:repo/pulls/:pull_number/commits", async (c) => {
		const { gh } = stores(context);
		const repo = assertRepo(context, c);
		const pullNumber = parseIntParam(c.req.param("pull_number"));
		const pull =
			repo && pullNumber
				? gh.pullRequests
						.findBy("repo_id", repo.id)
						.find((row) => row.number === pullNumber)
				: undefined;
		if (!repo || !pull) {
			return notFound(c);
		}
		const commits = commitsBetween(gh, repo.id, pull.base_sha, pull.head_sha);
		const authorization = c.req.header("Authorization") ?? "";
		const items = await Promise.all(
			paginate(c, commits, 100).map(async (commit) => {
				const response = await context.internalFetch(
					`/repos/${repo.full_name}/commits/${commit.sha}`,
					{ headers: { Authorization: authorization } },
				);
				const item = (await response.json()) as Record<string, unknown>;
				const { files: _files, stats: _stats, ...rest } = item;
				return rest;
			}),
		);
		return json(c, items);
	});

	// --- Reviews with line-based comments --------------------------------------
	app.post("/repos/:owner/:repo/pulls/:pull_number/reviews", async (c) => {
		const { gh, extras } = stores(context);
		const repo = assertRepo(context, c);
		const viewer = getViewer(gh, c);
		const pullNumber = parseIntParam(c.req.param("pull_number"));
		const pull =
			repo && pullNumber
				? gh.pullRequests
						.findBy("repo_id", repo.id)
						.find((row) => row.number === pullNumber)
				: undefined;
		if (!repo || !pull) {
			return notFound(c);
		}
		if (!viewer) {
			return requiresAuth(c);
		}
		const body = await readJson(c);
		const comments = (
			Array.isArray(body.comments) ? body.comments : []
		) as Array<Record<string, unknown>>;
		// Validate everything before writing so a 422 leaves no stray review.
		if (
			comments.some(
				(raw) => typeof raw?.path !== "string" || typeof raw?.body !== "string",
			)
		) {
			return c.json({ message: "Validation Failed" }, 422);
		}
		const event = body.event;
		const state =
			event === "APPROVE"
				? "APPROVED"
				: event === "REQUEST_CHANGES"
					? "CHANGES_REQUESTED"
					: event === "COMMENT"
						? "COMMENTED"
						: "PENDING";
		const now = new Date().toISOString();
		const review = gh.reviews.insert({
			node_id: "",
			repo_id: repo.id,
			pull_number: pull.number,
			user_id: viewer.id,
			body: typeof body.body === "string" ? body.body : null,
			state,
			commit_id:
				typeof body.commit_id === "string" ? body.commit_id : pull.head_sha,
			submitted_at: state === "PENDING" ? null : now,
		});
		gh.reviews.update(review.id, {
			node_id: Buffer.from(`0:PullRequestReview${review.id}`)
				.toString("base64")
				.replace(/=+$/u, ""),
		});

		for (const raw of comments) {
			const line = typeof raw.line === "number" ? raw.line : null;
			const position = typeof raw.position === "number" ? raw.position : null;
			const comment = gh.comments.insert({
				node_id: "",
				repo_id: repo.id,
				issue_number: null,
				pull_number: pull.number,
				commit_sha: review.commit_id,
				body: raw.body,
				user_id: viewer.id,
				in_reply_to_id: null,
				path: raw.path,
				position: position ?? line,
				line,
				side: raw.side === "LEFT" ? "LEFT" : "RIGHT",
				subject_type: raw.subject_type === "file" ? "file" : "line",
				comment_type: "review",
				review_id: review.id,
			} as Omit<GitHubComment, "id" | "created_at" | "updated_at">);
			gh.comments.update(comment.id, {
				node_id: Buffer.from(`0:PullRequestReviewComment${comment.id}`)
					.toString("base64")
					.replace(/=+$/u, ""),
			});
			if (typeof raw.start_line === "number") {
				extras.commentRanges.insert({
					comment_id: comment.id,
					start_line: raw.start_line,
					start_side: raw.start_side === "LEFT" ? "LEFT" : "RIGHT",
					outdated: false,
				});
			}
		}
		if (comments.length > 0) {
			gh.pullRequests.update(pull.id, {
				review_comments: pull.review_comments + comments.length,
			});
		}

		const authorization = c.req.header("Authorization") ?? "";
		const formatted = await context
			.internalFetch(
				`/repos/${repo.full_name}/pulls/${pull.number}/reviews/${review.id}`,
				{ headers: { Authorization: authorization } },
			)
			.then((response) => response.json());

		if (state !== "PENDING") {
			const pullJson = await context
				.internalFetch(`/repos/${repo.full_name}/pulls/${pull.number}`, {
					headers: { Authorization: authorization },
				})
				.then((response) => response.json());
			context.webhooks.dispatch(
				"pull_request_review",
				"submitted",
				{
					action: "submitted",
					review: formatted,
					pull_request: pullJson,
					repository: apiRepoJson(gh, repo, baseUrl),
					sender: apiUserJson(viewer, baseUrl),
				},
				ownerLogin(gh, repo),
				repo.name,
			);
		}
		return json(c, formatted, 200);
	});

	app.delete(
		"/repos/:owner/:repo/pulls/:pull_number/reviews/:review_id",
		async (c) => {
			const { gh } = stores(context);
			const repo = assertRepo(context, c);
			const viewer = getViewer(gh, c);
			const reviewId = parseIntParam(c.req.param("review_id"));
			const review = reviewId ? gh.reviews.get(reviewId) : undefined;
			if (!repo || !review || review.repo_id !== repo.id) {
				return notFound(c);
			}
			if (!viewer || review.user_id !== viewer.id) {
				return requiresAuth(c);
			}
			if (review.state !== "PENDING") {
				return c.json(
					{ message: "Can not delete a non-pending pull request review" },
					422,
				);
			}
			const formatted = await context
				.internalFetch(
					`/repos/${repo.full_name}/pulls/${review.pull_number}/reviews/${review.id}`,
					{ headers: { Authorization: c.req.header("Authorization") ?? "" } },
				)
				.then((response) => response.json());
			for (const comment of gh.comments.findBy("repo_id", repo.id)) {
				if (comment.review_id === review.id) {
					gh.comments.delete(comment.id);
				}
			}
			gh.reviews.delete(review.id);
			return json(c, formatted);
		},
	);

	app.post(
		"/repos/:owner/:repo/pulls/:pull_number/comments/:comment_id/replies",
		async (c) => {
			const { gh } = stores(context);
			const repo = assertRepo(context, c);
			const parentId = parseIntParam(c.req.param("comment_id"));
			const parent = parentId ? gh.comments.get(parentId) : undefined;
			if (!repo || !parent || parent.repo_id !== repo.id) {
				return notFound(c);
			}
			const body = await readJson(c);
			const rootId = parent.in_reply_to_id ?? parent.id;
			const response = await context.internalFetch(
				`/repos/${repo.full_name}/pulls/${c.req.param("pull_number")}/comments`,
				{
					method: "POST",
					headers: {
						Authorization: c.req.header("Authorization") ?? "",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						body: body.body,
						in_reply_to_id: rootId,
						path: parent.path,
						line: parent.line,
						side: parent.side,
						commit_id: parent.commit_sha,
					}),
				},
			);
			return new Response(response.body, {
				status: response.status,
				headers: response.headers,
			});
		},
	);
}
