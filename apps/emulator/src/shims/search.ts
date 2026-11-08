/**
 * Issue/PR search with the qualifiers DiffKit sends (`is:`, `repo:`, `org:`,
 * `user:`, `author:`, `assignee:`, `mentions:`, `involves:`,
 * `review-requested:`, `user-review-requested:`, `label:`, `archived:`,
 * negations and free text). Shared by GraphQL `search` and REST
 * `/search/issues`.
 */

import type { AuthUser } from "@emulators/core";
import type {
	GitHubIssue,
	GitHubPullRequest,
	GitHubRepo,
	GitHubStore,
} from "@emulators/github";
import type { ShimContext } from "../server.ts";
import {
	canReadRepo,
	getAuthUser,
	json,
	ownerLogin,
	parseIntParam,
	type ShimRequestContext,
	stores,
} from "./common.ts";

type Qualifier = { key: string; value: string; negated: boolean };

export type IssueSearchHit = {
	issue: GitHubIssue;
	pull: GitHubPullRequest | null;
	repo: GitHubRepo;
};

export function parseSearch(query: string) {
	const qualifiers: Qualifier[] = [];
	const text: string[] = [];
	const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/gu) ?? [];
	for (const token of tokens) {
		const negated = token.startsWith("-");
		const raw = negated ? token.slice(1) : token;
		const separator = raw.indexOf(":");
		if (separator > 0) {
			qualifiers.push({
				key: raw.slice(0, separator).toLowerCase(),
				value: raw.slice(separator + 1).replace(/^"|"$/gu, ""),
				negated,
			});
		} else {
			text.push(raw.replace(/^"|"$/gu, "").toLowerCase());
		}
	}
	return { qualifiers, text };
}

function resolveLogin(value: string, viewerLogin: string | undefined) {
	return value === "@me" ? (viewerLogin ?? "") : value;
}

function participants(
	gh: GitHubStore,
	issue: GitHubIssue,
	pull: GitHubPullRequest | null,
) {
	const ids = new Set<number>([issue.user_id, ...issue.assignee_ids]);
	for (const id of pull?.assignee_ids ?? []) ids.add(id);
	for (const id of pull?.requested_reviewer_ids ?? []) ids.add(id);
	for (const comment of gh.comments.findBy("repo_id", issue.repo_id)) {
		if (
			comment.issue_number === issue.number ||
			comment.pull_number === issue.number
		) {
			ids.add(comment.user_id);
		}
	}
	for (const review of gh.reviews.findBy("repo_id", issue.repo_id)) {
		if (review.pull_number === issue.number && review.state !== "PENDING") {
			ids.add(review.user_id);
		}
	}
	return ids;
}

function mentions(gh: GitHubStore, issue: GitHubIssue, login: string) {
	const needle = `@${login.toLowerCase()}`;
	if ((issue.body ?? "").toLowerCase().includes(needle)) {
		return true;
	}
	return gh.comments
		.findBy("repo_id", issue.repo_id)
		.some(
			(comment) =>
				(comment.issue_number === issue.number ||
					comment.pull_number === issue.number) &&
				comment.body.toLowerCase().includes(needle),
		);
}

function matchesQualifier(
	gh: GitHubStore,
	hit: IssueSearchHit,
	qualifier: Qualifier,
	viewerLogin: string | undefined,
): boolean {
	const { issue, pull, repo } = hit;
	const value = qualifier.value.toLowerCase();
	const userId = () =>
		gh.users.findOneBy("login", resolveLogin(qualifier.value, viewerLogin))?.id;
	switch (qualifier.key) {
		case "is":
		case "type":
			if (value === "pr" || value === "pull-request") return Boolean(pull);
			if (value === "issue") return !pull;
			if (value === "open") return issue.state === "open";
			if (value === "closed") return issue.state === "closed";
			if (value === "merged") return Boolean(pull?.merged);
			if (value === "unmerged") return Boolean(pull) && !pull?.merged;
			if (value === "draft") return Boolean(pull?.draft);
			if (value === "public") return !repo.private;
			if (value === "private") return repo.private;
			return true;
		case "state":
			return issue.state === value;
		case "draft":
			return Boolean(pull?.draft) === (value === "true");
		case "archived":
			return repo.archived === (value === "true");
		case "repo":
			return repo.full_name.toLowerCase() === value;
		case "org":
		case "user":
		case "owner":
			return ownerLogin(gh, repo).toLowerCase() === value;
		case "author":
			return issue.user_id === userId();
		case "assignee": {
			const id = userId();
			return Boolean(
				id &&
					(issue.assignee_ids.includes(id) || pull?.assignee_ids.includes(id)),
			);
		}
		case "review-requested":
		case "user-review-requested": {
			const id = userId();
			return Boolean(id && pull?.requested_reviewer_ids.includes(id));
		}
		case "reviewed-by": {
			const id = userId();
			return gh.reviews
				.findBy("repo_id", repo.id)
				.some(
					(review) =>
						review.pull_number === issue.number &&
						review.user_id === id &&
						review.state !== "PENDING",
				);
		}
		case "mentions":
			return mentions(gh, issue, resolveLogin(qualifier.value, viewerLogin));
		case "involves": {
			const login = resolveLogin(qualifier.value, viewerLogin);
			const id = gh.users.findOneBy("login", login)?.id;
			return Boolean(
				(id && participants(gh, issue, pull).has(id)) ||
					mentions(gh, issue, login),
			);
		}
		case "label": {
			const labelIds = new Set([
				...issue.label_ids,
				...(pull?.label_ids ?? []),
			]);
			return [...labelIds].some(
				(id) => gh.labels.get(id)?.name.toLowerCase() === value,
			);
		}
		case "sort":
		case "in":
			return true;
		default:
			return true;
	}
}

export function searchIssues(
	context: ShimContext,
	query: string,
	auth: AuthUser | undefined,
): IssueSearchHit[] {
	const { gh } = stores(context);
	const parsed = parseSearch(query);
	const viewerLogin = auth && !auth.installation ? auth.login : undefined;
	const hits: IssueSearchHit[] = [];
	for (const issue of gh.issues.all()) {
		const repo = gh.repos.get(issue.repo_id);
		if (!repo || !canReadRepo(gh, auth, repo)) {
			continue;
		}
		const pull = issue.is_pull_request
			? (gh.pullRequests
					.findBy("repo_id", repo.id)
					.find((row) => row.number === issue.number) ?? null)
			: null;
		const hit = { issue, pull, repo };
		const qualifiersMatch = parsed.qualifiers.every(
			(qualifier) =>
				matchesQualifier(gh, hit, qualifier, viewerLogin) !== qualifier.negated,
		);
		if (!qualifiersMatch) {
			continue;
		}
		const haystack = `${issue.title}\n${issue.body ?? ""}`.toLowerCase();
		if (!parsed.text.every((word) => haystack.includes(word))) {
			continue;
		}
		hits.push(hit);
	}
	const sort =
		parsed.qualifiers.find((qualifier) => qualifier.key === "sort")?.value ??
		"updated-desc";
	const field = sort.startsWith("created") ? "created_at" : "updated_at";
	const direction = sort.endsWith("-asc") ? 1 : -1;
	return hits.sort(
		(a, b) =>
			direction *
			(a.issue[field].localeCompare(b.issue[field]) || a.issue.id - b.issue.id),
	);
}

/** REST `/search/issues` with the qualifier support above. */
export function registerSearchRoute(context: ShimContext) {
	context.app.get("/search/issues", async (c: ShimRequestContext) => {
		const query = c.req.query("q") ?? "";
		const hits = searchIssues(context, query, getAuthUser(c));
		const perPage = Math.min(100, parseIntParam(c.req.query("per_page")) ?? 30);
		const page = Math.max(1, parseIntParam(c.req.query("page")) ?? 1);
		const slice = hits.slice((page - 1) * perPage, page * perPage);
		const authorization = c.req.header("Authorization") ?? "";
		const items = await Promise.all(
			slice.map(async ({ issue, repo }) => {
				const response = await context.internalFetch(
					`/repos/${repo.full_name}/issues/${issue.number}`,
					{ headers: { Authorization: authorization } },
				);
				const item = (await response.json()) as Record<string, unknown>;
				return { ...item, score: 1 };
			}),
		);
		return json(c, {
			total_count: hits.length,
			incomplete_results: false,
			items,
		});
	});
}
