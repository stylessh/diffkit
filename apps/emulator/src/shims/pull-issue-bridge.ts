/**
 * GitHub treats every pull request as an issue: `GET/PATCH /issues/:n` and the
 * assignee endpoints accept PR numbers. emulate 404s them, so this layer runs
 * before emulate's router and handles only the PR case; issues pass through.
 */
import type { AuthUser } from "@emulators/core";
import type {
	GitHubIssue,
	GitHubPullRequest,
	GitHubRepo,
} from "@emulators/github";
import type { ShimContext } from "../server.ts";
import { findRepo, stores } from "./common.ts";

const ISSUE_PATH =
	/^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)(\/assignees)?\/?$/u;

function authFor(context: ShimContext, request: Request): AuthUser | undefined {
	const header = request.headers.get("Authorization");
	if (!header) {
		return undefined;
	}
	const token = header.replace(/^(Bearer|token)\s+/iu, "").trim();
	return context.tokenMap.get(token);
}

function jsonResponse(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

async function pullAsIssue(
	context: ShimContext,
	request: Request,
	repo: GitHubRepo,
	issue: GitHubIssue,
	pull: GitHubPullRequest,
) {
	const response = await context.app.fetch(
		new Request(
			`${context.baseUrl}/repos/${repo.full_name}/pulls/${pull.number}`,
			{
				headers: { Authorization: request.headers.get("Authorization") ?? "" },
			},
		),
	);
	if (!response.ok) {
		return response;
	}
	const pr = (await response.json()) as Record<string, unknown>;
	const issueUrl = `${context.baseUrl}/repos/${repo.full_name}/issues/${pull.number}`;
	return jsonResponse({
		url: issueUrl,
		repository_url: `${context.baseUrl}/repos/${repo.full_name}`,
		labels_url: `${issueUrl}/labels{/name}`,
		comments_url: `${issueUrl}/comments`,
		events_url: `${issueUrl}/events`,
		timeline_url: `${issueUrl}/timeline`,
		html_url: pr.html_url,
		id: issue.id,
		node_id: issue.node_id,
		number: pull.number,
		title: pull.title,
		user: pr.user,
		labels: pr.labels ?? [],
		state: pull.state,
		state_reason: null,
		locked: pull.locked,
		assignee: pr.assignee ?? null,
		assignees: pr.assignees ?? [],
		milestone: pr.milestone ?? null,
		comments: issue.comments,
		created_at: pull.created_at,
		updated_at: pull.updated_at,
		closed_at: pull.closed_at,
		author_association: pr.author_association ?? "NONE",
		active_lock_reason: null,
		draft: pull.draft,
		body: pull.body,
		reactions: { url: `${issueUrl}/reactions`, total_count: 0 },
		pull_request: {
			url: pr.url,
			html_url: pr.html_url,
			diff_url: pr.diff_url ?? null,
			patch_url: pr.patch_url ?? null,
			merged_at: pull.merged_at,
		},
	});
}

export async function bridgePullIssueRequest(
	context: ShimContext,
	request: Request,
): Promise<Response | null> {
	const url = new URL(request.url);
	const match = url.pathname.match(ISSUE_PATH);
	if (!match) {
		return null;
	}
	const [, owner, name, rawNumber, assigneesSuffix] = match;
	const { gh } = stores(context);
	const repo = findRepo(gh, owner, name);
	if (!repo) {
		return null;
	}
	const number = Number(rawNumber);
	const pull = gh.pullRequests
		.findBy("repo_id", repo.id)
		.find((row) => row.number === number);
	const issue = gh.issues
		.findBy("repo_id", repo.id)
		.find((row) => row.number === number);
	if (!pull || !issue) {
		return null;
	}

	const method = request.method.toUpperCase();
	if (method === "GET" && !assigneesSuffix) {
		return pullAsIssue(context, request, repo, issue, pull);
	}

	const auth = authFor(context, request);
	if (!auth) {
		return jsonResponse({ message: "Requires authentication" }, 401);
	}
	let body: Record<string, unknown> = {};
	try {
		body = (await request.clone().json()) as Record<string, unknown>;
	} catch {
		body = {};
	}

	if (assigneesSuffix && (method === "POST" || method === "DELETE")) {
		const logins = Array.isArray(body.assignees) ? body.assignees : [];
		const ids = logins
			.map((login) => gh.users.findOneBy("login", String(login))?.id)
			.filter((id): id is number => typeof id === "number");
		const current = new Set(issue.assignee_ids);
		for (const id of ids) {
			if (method === "POST") current.add(id);
			else current.delete(id);
		}
		const assignee_ids = [...current];
		gh.issues.update(issue.id, { assignee_ids });
		gh.pullRequests.update(pull.id, { assignee_ids });
		const actor = gh.users.findOneBy("login", auth.login);
		context.webhooks.dispatch(
			"pull_request",
			method === "POST" ? "assigned" : "unassigned",
			{
				action: method === "POST" ? "assigned" : "unassigned",
				number,
				pull_request: { number },
				assignee: logins[0] ? { login: String(logins[0]) } : null,
				repository: { full_name: repo.full_name, name: repo.name },
				sender: { login: actor?.login },
			},
			owner,
			repo.name,
		);
		const refreshedIssue = gh.issues.get(issue.id) as GitHubIssue;
		const refreshedPull = gh.pullRequests.get(pull.id) as GitHubPullRequest;
		return pullAsIssue(context, request, repo, refreshedIssue, refreshedPull);
	}

	if (method === "PATCH" && !assigneesSuffix) {
		const pullPatch: Record<string, unknown> = {};
		for (const key of ["title", "body", "state"] as const) {
			if (key in body) pullPatch[key] = body[key];
		}
		if (Object.keys(pullPatch).length > 0) {
			const response = await context.app.fetch(
				new Request(
					`${context.baseUrl}/repos/${repo.full_name}/pulls/${number}`,
					{
						method: "PATCH",
						headers: {
							Authorization: request.headers.get("Authorization") ?? "",
							"Content-Type": "application/json",
						},
						body: JSON.stringify(pullPatch),
					},
				),
			);
			if (!response.ok) {
				return response;
			}
		}
		if ("milestone" in body) {
			const milestone =
				body.milestone === null
					? null
					: gh.milestones
							.findBy("repo_id", repo.id)
							.find((row) => row.number === Number(body.milestone));
			const milestone_id = milestone ? milestone.id : null;
			gh.issues.update(issue.id, { milestone_id });
			gh.pullRequests.update(pull.id, { milestone_id });
		}
		if (Array.isArray(body.assignees)) {
			const assignee_ids = body.assignees
				.map((login) => gh.users.findOneBy("login", String(login))?.id)
				.filter((id): id is number => typeof id === "number");
			gh.issues.update(issue.id, { assignee_ids });
			gh.pullRequests.update(pull.id, { assignee_ids });
		}
		const refreshedIssue = gh.issues.get(issue.id) as GitHubIssue;
		const refreshedPull = gh.pullRequests.get(pull.id) as GitHubPullRequest;
		if (refreshedPull.state !== refreshedIssue.state) {
			gh.issues.update(issue.id, {
				state: refreshedPull.state,
				closed_at: refreshedPull.closed_at,
			});
		}
		return pullAsIssue(
			context,
			request,
			repo,
			gh.issues.get(issue.id) as GitHubIssue,
			refreshedPull,
		);
	}

	return null;
}
