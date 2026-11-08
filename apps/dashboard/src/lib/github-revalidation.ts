/**
 * Legacy cache-key labels. The webhook revalidation pipeline these keyed was
 * removed (see docs/platform-plan.md, "Incidents"); call sites still pass them
 * to getOrRevalidateGitHubResource, which ignores them.
 */
export const githubRevalidationSignalKeys = {
	pullsMine: "pulls.mine",
	issuesMine: "issues.mine",
	notifications: "notifications",
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
