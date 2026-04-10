function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
	return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
	return typeof value === "number" ? value : undefined;
}

export function getGitHubWebhookPayloadMetadata(payload: unknown) {
	if (Array.isArray(payload)) {
		return {
			payloadType: "array",
			itemCount: payload.length,
		};
	}

	if (!isRecord(payload)) {
		return {
			payloadType: payload === null ? "null" : typeof payload,
		};
	}

	const repository = isRecord(payload.repository)
		? payload.repository
		: undefined;
	const owner =
		repository && isRecord(repository.owner) ? repository.owner : undefined;
	const installation = isRecord(payload.installation)
		? payload.installation
		: undefined;
	const sender = isRecord(payload.sender) ? payload.sender : undefined;
	const pullRequest = isRecord(payload.pull_request)
		? payload.pull_request
		: undefined;
	const issue = isRecord(payload.issue) ? payload.issue : undefined;
	const workflowRun = isRecord(payload.workflow_run)
		? payload.workflow_run
		: undefined;
	const workflowJob = isRecord(payload.workflow_job)
		? payload.workflow_job
		: undefined;
	const checkRun = isRecord(payload.check_run) ? payload.check_run : undefined;
	const checkSuite = isRecord(payload.check_suite)
		? payload.check_suite
		: undefined;
	const repositoryName = getString(repository?.name);
	const repositoryOwner = getString(owner?.login);

	return {
		payloadType: "object",
		payloadKeys: Object.keys(payload).sort(),
		action: getString(payload.action),
		repository:
			repositoryOwner && repositoryName
				? `${repositoryOwner}/${repositoryName}`
				: undefined,
		sender: getString(sender?.login),
		installationId: getNumber(installation?.id),
		pullNumber: getNumber(pullRequest?.number),
		issueNumber: getNumber(issue?.number),
		workflowRunId: getNumber(workflowRun?.id) ?? getNumber(workflowJob?.run_id),
		workflowJobId: getNumber(workflowJob?.id),
		checkRunId: getNumber(checkRun?.id),
		checkSuiteId: getNumber(checkSuite?.id),
	};
}
