import type { Tab } from "./tab-store";

export const githubRevalidationSignalKeys = {
	pullsMine: "pulls.mine",
	issuesMine: "issues.mine",
	repoMeta: (input: { owner: string; repo: string }) =>
		`repoMeta:${input.owner}/${input.repo}`,
	repoLabels: (input: { owner: string; repo: string }) =>
		`repoLabels:${input.owner}/${input.repo}`,
	repoCollaborators: (input: { owner: string; repo: string }) =>
		`repoCollaborators:${input.owner}/${input.repo}`,
	orgTeams: (input: { org: string }) => `orgTeams:${input.org}`,
	actionsRepo: (input: { owner: string; repo: string }) =>
		`actions:${input.owner}/${input.repo}`,
	pullEntity: (input: { owner: string; repo: string; pullNumber: number }) =>
		`pull:${input.owner}/${input.repo}#${input.pullNumber}`,
	issueEntity: (input: { owner: string; repo: string; issueNumber: number }) =>
		`issue:${input.owner}/${input.repo}#${input.issueNumber}`,
	workflowRunEntity: (input: { owner: string; repo: string; runId: number }) =>
		`workflowRun:${input.owner}/${input.repo}#${input.runId}`,
	workflowJobEntity: (input: { owner: string; repo: string; jobId: number }) =>
		`workflowJob:${input.owner}/${input.repo}#${input.jobId}`,
	repoCode: (input: { owner: string; repo: string }) =>
		`repoCode:${input.owner}/${input.repo}`,
	repoProtection: (input: { owner: string; repo: string }) =>
		`repoProtection:${input.owner}/${input.repo}`,
	repoStatuses: (input: { owner: string; repo: string }) =>
		`repoStatuses:${input.owner}/${input.repo}`,
	installationAccess: "installationAccess",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function getRepositoryIdentity(payload: unknown) {
	if (!isRecord(payload)) {
		return null;
	}

	const repository = payload.repository;
	if (!isRecord(repository)) {
		return null;
	}

	const repo = repository.name;
	const owner = isRecord(repository.owner) ? repository.owner.login : null;
	if (typeof owner !== "string" || typeof repo !== "string") {
		return null;
	}

	return { owner, repo };
}

function getPullRequestNumber(payload: unknown) {
	if (!isRecord(payload) || !isRecord(payload.pull_request)) {
		return null;
	}

	return typeof payload.pull_request.number === "number"
		? payload.pull_request.number
		: null;
}

function getIssueIdentity(payload: unknown) {
	if (!isRecord(payload) || !isRecord(payload.issue)) {
		return null;
	}

	const number = payload.issue.number;
	if (typeof number !== "number") {
		return null;
	}

	return {
		number,
		isPullRequest: isRecord(payload.issue.pull_request),
	};
}

function getWorkflowRunId(payload: unknown) {
	if (!isRecord(payload)) {
		return null;
	}

	if (
		isRecord(payload.workflow_run) &&
		typeof payload.workflow_run.id === "number"
	) {
		return payload.workflow_run.id;
	}

	if (
		isRecord(payload.workflow_job) &&
		typeof payload.workflow_job.run_id === "number"
	) {
		return payload.workflow_job.run_id;
	}

	return null;
}

function getWorkflowJobId(payload: unknown) {
	if (!isRecord(payload) || !isRecord(payload.workflow_job)) {
		return null;
	}

	return typeof payload.workflow_job.id === "number"
		? payload.workflow_job.id
		: null;
}

function getCheckRunPullSignals(payload: unknown) {
	const repository = getRepositoryIdentity(payload);
	if (!repository || !isRecord(payload)) {
		return [];
	}

	const checkRun = payload.check_run;
	if (!isRecord(checkRun) || !Array.isArray(checkRun.pull_requests)) {
		return [];
	}

	return checkRun.pull_requests.flatMap((pull) => {
		if (!isRecord(pull) || typeof pull.number !== "number") {
			return [];
		}

		return [
			githubRevalidationSignalKeys.pullEntity({
				owner: repository.owner,
				repo: repository.repo,
				pullNumber: pull.number,
			}),
		];
	});
}

function getCheckSuitePullSignals(payload: unknown) {
	const repository = getRepositoryIdentity(payload);
	if (!repository || !isRecord(payload)) {
		return [];
	}

	const checkSuite = payload.check_suite;
	if (!isRecord(checkSuite) || !Array.isArray(checkSuite.pull_requests)) {
		return [];
	}

	return checkSuite.pull_requests.flatMap((pull) => {
		if (!isRecord(pull) || typeof pull.number !== "number") {
			return [];
		}

		return [
			githubRevalidationSignalKeys.pullEntity({
				owner: repository.owner,
				repo: repository.repo,
				pullNumber: pull.number,
			}),
		];
	});
}

function getWorkflowRunPullSignals(payload: unknown) {
	const repository = getRepositoryIdentity(payload);
	if (!repository || !isRecord(payload) || !isRecord(payload.workflow_run)) {
		return [];
	}

	const prs = payload.workflow_run.pull_requests;
	if (!Array.isArray(prs)) {
		return [];
	}

	return prs.flatMap((pull) => {
		if (!isRecord(pull) || typeof pull.number !== "number") {
			return [];
		}

		return [
			githubRevalidationSignalKeys.pullEntity({
				owner: repository.owner,
				repo: repository.repo,
				pullNumber: pull.number,
			}),
		];
	});
}

export function getGitHubWebhookRevalidationSignalKeys(
	event: string,
	payload: unknown,
) {
	if (
		event === "installation" ||
		event === "installation_repositories" ||
		event === "github_app_authorization"
	) {
		return [githubRevalidationSignalKeys.installationAccess];
	}

	const repository = getRepositoryIdentity(payload);
	if (!repository) {
		return [];
	}

	if (event === "pull_request" || event === "pull_request_review") {
		const pullNumber = getPullRequestNumber(payload);
		return typeof pullNumber === "number"
			? [
					githubRevalidationSignalKeys.pullsMine,
					githubRevalidationSignalKeys.repoMeta({
						owner: repository.owner,
						repo: repository.repo,
					}),
					githubRevalidationSignalKeys.pullEntity({
						owner: repository.owner,
						repo: repository.repo,
						pullNumber,
					}),
				]
			: [
					githubRevalidationSignalKeys.pullsMine,
					githubRevalidationSignalKeys.repoMeta({
						owner: repository.owner,
						repo: repository.repo,
					}),
				];
	}

	if (
		event === "pull_request_review_comment" ||
		event === "pull_request_review_thread"
	) {
		const pullNumber = getPullRequestNumber(payload);
		return typeof pullNumber === "number"
			? [
					githubRevalidationSignalKeys.pullEntity({
						owner: repository.owner,
						repo: repository.repo,
						pullNumber,
					}),
				]
			: [];
	}

	if (event === "issues") {
		const issueIdentity = getIssueIdentity(payload);
		if (!issueIdentity) {
			return [githubRevalidationSignalKeys.issuesMine];
		}

		return issueIdentity.isPullRequest
			? [
					githubRevalidationSignalKeys.pullsMine,
					githubRevalidationSignalKeys.repoMeta({
						owner: repository.owner,
						repo: repository.repo,
					}),
					githubRevalidationSignalKeys.pullEntity({
						owner: repository.owner,
						repo: repository.repo,
						pullNumber: issueIdentity.number,
					}),
				]
			: [
					githubRevalidationSignalKeys.issuesMine,
					githubRevalidationSignalKeys.repoMeta({
						owner: repository.owner,
						repo: repository.repo,
					}),
					githubRevalidationSignalKeys.issueEntity({
						owner: repository.owner,
						repo: repository.repo,
						issueNumber: issueIdentity.number,
					}),
				];
	}

	if (event === "issue_comment") {
		const issueIdentity = getIssueIdentity(payload);
		if (!issueIdentity) {
			return [];
		}

		return issueIdentity.isPullRequest
			? [
					githubRevalidationSignalKeys.pullEntity({
						owner: repository.owner,
						repo: repository.repo,
						pullNumber: issueIdentity.number,
					}),
				]
			: [
					githubRevalidationSignalKeys.issueEntity({
						owner: repository.owner,
						repo: repository.repo,
						issueNumber: issueIdentity.number,
					}),
				];
	}

	if (event === "push") {
		return [
			githubRevalidationSignalKeys.repoMeta({
				owner: repository.owner,
				repo: repository.repo,
			}),
			githubRevalidationSignalKeys.repoCode({
				owner: repository.owner,
				repo: repository.repo,
			}),
		];
	}

	if (event === "create" || event === "delete") {
		return [
			githubRevalidationSignalKeys.pullsMine,
			githubRevalidationSignalKeys.repoMeta({
				owner: repository.owner,
				repo: repository.repo,
			}),
			githubRevalidationSignalKeys.repoCode({
				owner: repository.owner,
				repo: repository.repo,
			}),
		];
	}

	if (event === "check_run") {
		return getCheckRunPullSignals(payload);
	}

	if (event === "check_suite") {
		return getCheckSuitePullSignals(payload);
	}

	if (
		event === "repository_ruleset" ||
		event === "branch_protection_rule" ||
		event === "branch_protection_configuration"
	) {
		return [
			githubRevalidationSignalKeys.repoProtection({
				owner: repository.owner,
				repo: repository.repo,
			}),
		];
	}

	// GitHub's `status` webhook payload has no pull_requests field, so we fan
	// out to a repo-scoped signal. Any open PR page in the repo subscribes to
	// this and re-fetches its status — captures CodeRabbit/CircleCI updates.
	if (event === "status") {
		return [
			githubRevalidationSignalKeys.repoStatuses({
				owner: repository.owner,
				repo: repository.repo,
			}),
		];
	}

	if (event === "workflow_run") {
		const runId = getWorkflowRunId(payload);
		const pullSignals = getWorkflowRunPullSignals(payload);
		return typeof runId === "number"
			? [
					githubRevalidationSignalKeys.actionsRepo({
						owner: repository.owner,
						repo: repository.repo,
					}),
					githubRevalidationSignalKeys.workflowRunEntity({
						owner: repository.owner,
						repo: repository.repo,
						runId,
					}),
					...pullSignals,
				]
			: [
					githubRevalidationSignalKeys.actionsRepo({
						owner: repository.owner,
						repo: repository.repo,
					}),
					...pullSignals,
				];
	}

	if (event === "workflow_job") {
		const runId = getWorkflowRunId(payload);
		const jobId = getWorkflowJobId(payload);

		return [
			githubRevalidationSignalKeys.actionsRepo({
				owner: repository.owner,
				repo: repository.repo,
			}),
			...(typeof runId === "number"
				? [
						githubRevalidationSignalKeys.workflowRunEntity({
							owner: repository.owner,
							repo: repository.repo,
							runId,
						}),
					]
				: []),
			...(typeof jobId === "number"
				? [
						githubRevalidationSignalKeys.workflowJobEntity({
							owner: repository.owner,
							repo: repository.repo,
							jobId,
						}),
					]
				: []),
		];
	}

	return [];
}

export function getGitHubRevalidationSignalKeysForTab(tab: Tab) {
	const [owner, repo] = tab.repo.split("/");

	if (tab.type === "repo") {
		return [
			githubRevalidationSignalKeys.repoCode({
				owner,
				repo,
			}),
		];
	}

	if (tab.type === "actions") {
		// `tab.number` is the human-readable run number (e.g. #42), not the API
		// run_id, so we can't subscribe to a specific run/job entity here. The
		// repo-wide actions signal covers the list view; per-entity refresh
		// happens via useGitHubSignalStream calls in the page components.
		return [githubRevalidationSignalKeys.actionsRepo({ owner, repo })];
	}

	if (tab.number == null) return [];

	if (tab.type === "pull" || tab.type === "review") {
		return [
			githubRevalidationSignalKeys.pullEntity({
				owner,
				repo,
				pullNumber: tab.number,
			}),
		];
	}

	return [
		githubRevalidationSignalKeys.issueEntity({
			owner,
			repo,
			issueNumber: tab.number,
		}),
	];
}
