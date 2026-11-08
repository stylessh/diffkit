/**
 * Change-feed entity keys: what changed on GitHub, at a granularity the client
 * can map to query keys (see `queryFiltersForEntity` in github.query.ts).
 *
 *   pull:owner/repo#12        a pull request (detail, timeline, reviews, lists)
 *   issue:owner/repo#4        an issue
 *   repo:owner/repo           code, refs, commits, repo metadata
 *   checks:owner/repo@sha     check runs / commit statuses for a commit
 *   run:owner/repo#123        a workflow run and its jobs
 *   release:owner/repo        releases
 *   labels:owner/repo         the label set
 *   collaborators:owner/repo  collaborators
 *   discussions:owner/repo    discussions
 *   settings:owner/repo       webhooks, Actions secrets and variables; no
 *                             webhook reports these, so only this app's own
 *                             mutations raise it
 *   org:login                 organization settings, members and teams; the
 *                             feed is keyed by repository, so only this app's
 *                             own mutations raise it
 *
 * Repo names are stored lowercased; GitHub logins and repo names are
 * case-insensitive.
 *
 * Shared by the webhook handler (server) and the change-feed client.
 */

export type GitHubRepoEntity =
	| { kind: "pull"; repo: string; number: number }
	| { kind: "issue"; repo: string; number: number }
	| { kind: "repo"; repo: string }
	| { kind: "checks"; repo: string; sha: string }
	| { kind: "run"; repo: string; runId: number }
	| { kind: "release"; repo: string }
	| { kind: "labels"; repo: string }
	| { kind: "collaborators"; repo: string }
	| { kind: "discussions"; repo: string }
	| { kind: "settings"; repo: string };

export type GitHubOrgEntity = { kind: "org"; org: string };

export type GitHubChangeEntity = GitHubRepoEntity | GitHubOrgEntity;

export type GitHubChangeEntityKind = GitHubChangeEntity["kind"];

export function normalizeRepoFullName(owner: string, repo: string) {
	return `${owner}/${repo}`.toLowerCase();
}

export function formatEntityKey(entity: GitHubChangeEntity): string {
	switch (entity.kind) {
		case "pull":
		case "issue":
			return `${entity.kind}:${entity.repo}#${entity.number}`;
		case "run":
			return `run:${entity.repo}#${entity.runId}`;
		case "checks":
			return `checks:${entity.repo}@${entity.sha}`;
		case "org":
			return `org:${entity.org}`;
		default:
			return `${entity.kind}:${entity.repo}`;
	}
}

const REPO_PATTERN = "([^/\\s#@]+/[^/\\s#@]+)";
const NUMBERED = new RegExp(`^(pull|issue|run):${REPO_PATTERN}#(\\d+)$`);
const CHECKS = new RegExp(`^checks:${REPO_PATTERN}@([0-9a-f]{7,40})$`);
const REPO_ONLY = new RegExp(
	`^(repo|release|labels|collaborators|discussions|settings):${REPO_PATTERN}$`,
);

const ORG_ONLY = /^org:([^/\s#@]+)$/;

export function parseEntityKey(key: string): GitHubChangeEntity | null {
	const org = ORG_ONLY.exec(key);
	if (org) return { kind: "org", org: org[1].toLowerCase() };
	const numbered = NUMBERED.exec(key);
	if (numbered) {
		const [, kind, repo, raw] = numbered;
		const value = Number(raw);
		if (!Number.isSafeInteger(value)) return null;
		const normalized = repo.toLowerCase();
		if (kind === "run") return { kind, repo: normalized, runId: value };
		if (kind === "pull" || kind === "issue") {
			return { kind, repo: normalized, number: value };
		}
		return null;
	}
	const checks = CHECKS.exec(key);
	if (checks) {
		return {
			kind: "checks",
			repo: checks[1].toLowerCase(),
			sha: checks[2].toLowerCase(),
		};
	}
	const repoOnly = REPO_ONLY.exec(key);
	if (repoOnly) {
		const [, kind, repo] = repoOnly;
		switch (kind) {
			case "repo":
			case "release":
			case "labels":
			case "collaborators":
			case "discussions":
			case "settings":
				return { kind, repo: repo.toLowerCase() };
			default:
				return null;
		}
	}
	return null;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isSafeInteger(value)
		? value
		: null;
}

function getSha(value: unknown): string | null {
	return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value)
		? value.toLowerCase()
		: null;
}

export type WebhookRepository = {
	/** Lowercased `owner/repo`. */
	fullName: string;
	/** `true` unless the payload says the repo is public. */
	isPrivate: boolean;
};

export function getWebhookRepository(
	payload: unknown,
): WebhookRepository | null {
	if (!isRecord(payload) || !isRecord(payload.repository)) return null;
	const repository = payload.repository;
	const owner = isRecord(repository.owner) ? repository.owner.login : null;
	const name = repository.name;
	if (typeof owner !== "string" || typeof name !== "string") return null;
	return {
		fullName: normalizeRepoFullName(owner, name),
		isPrivate: repository.private !== false,
	};
}

function pullNumbersFrom(list: unknown): number[] {
	if (!Array.isArray(list)) return [];
	return list.flatMap((pull: unknown) => {
		const number = isRecord(pull) ? getNumber(pull.number) : null;
		return number === null ? [] : [number];
	});
}

/**
 * Maps a GitHub webhook delivery to the entities it changed. Events that
 * nothing in the dashboard reads (stars, forks, …) and installation events
 * (handled by token invalidation) map to an empty list.
 *
 * Based on `getGitHubWebhookRevalidationSignalKeys` from before #193.
 */
export function getWebhookChangeEntities(
	event: string,
	payload: unknown,
): GitHubRepoEntity[] {
	const repository = getWebhookRepository(payload);
	if (!repository || !isRecord(payload)) return [];
	const repo = repository.fullName;

	switch (event) {
		case "pull_request":
		case "pull_request_review":
		case "pull_request_review_comment":
		case "pull_request_review_thread": {
			const number = isRecord(payload.pull_request)
				? getNumber(payload.pull_request.number)
				: null;
			if (number === null) return [];
			const entities: GitHubRepoEntity[] = [{ kind: "pull", repo, number }];
			// New commits change the head; the code view follows the branch.
			if (event === "pull_request" && payload.action === "synchronize") {
				entities.push({ kind: "repo", repo });
			}
			return entities;
		}

		case "issues":
		case "issue_comment": {
			if (!isRecord(payload.issue)) return [];
			const number = getNumber(payload.issue.number);
			if (number === null) return [];
			const isPull = isRecord(payload.issue.pull_request);
			return [{ kind: isPull ? "pull" : "issue", repo, number }];
		}

		case "push":
		case "create":
		case "delete":
		case "repository":
		case "branch_protection_rule":
		case "branch_protection_configuration":
		case "repository_ruleset":
			return [{ kind: "repo", repo }];

		case "check_run":
		case "check_suite": {
			const value = payload[event];
			const container = isRecord(value) ? value : null;
			const sha = container ? getSha(container.head_sha) : null;
			const pulls = container ? pullNumbersFrom(container.pull_requests) : [];
			return [
				...(sha ? [{ kind: "checks", repo, sha } as const] : []),
				...pulls.map((number) => ({ kind: "pull", repo, number }) as const),
			].filter(dedupe());
		}

		case "status": {
			const sha = getSha(payload.sha);
			return sha ? [{ kind: "checks", repo, sha }] : [];
		}

		case "workflow_run": {
			if (!isRecord(payload.workflow_run)) return [];
			const run = payload.workflow_run;
			const runId = getNumber(run.id);
			const sha = getSha(run.head_sha);
			return [
				...(runId !== null ? [{ kind: "run", repo, runId } as const] : []),
				...(sha ? [{ kind: "checks", repo, sha } as const] : []),
			];
		}

		case "workflow_job": {
			if (!isRecord(payload.workflow_job)) return [];
			const job = payload.workflow_job;
			const runId = getNumber(job.run_id);
			const sha = getSha(job.head_sha);
			return [
				...(runId !== null ? [{ kind: "run", repo, runId } as const] : []),
				...(sha ? [{ kind: "checks", repo, sha } as const] : []),
			];
		}

		case "release":
			return [{ kind: "release", repo }];

		case "label":
			return [{ kind: "labels", repo }];

		case "member":
		case "membership":
		case "team_add":
			return [{ kind: "collaborators", repo }];

		case "discussion":
		case "discussion_comment":
			return [{ kind: "discussions", repo }];

		default:
			return [];
	}
}

function dedupe() {
	const seen = new Set<string>();
	return (entity: GitHubRepoEntity) => {
		const key = formatEntityKey(entity);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	};
}
