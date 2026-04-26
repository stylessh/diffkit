import { describe, expect, it } from "vitest";
import { getGitHubWebhookRevalidationSignalKeys } from "./github-revalidation";

describe("getGitHubWebhookRevalidationSignalKeys", () => {
	it("maps pull request webhook events to list and pull signals", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("pull_request", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
				pull_request: { number: 42 },
			}),
		).toEqual([
			"pulls.mine",
			"notifications",
			"repoMeta:stylessh/havana",
			"pull:stylessh/havana#42",
		]);
	});

	it("treats issue comments on pull requests as pull signals", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("issue_comment", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
				issue: {
					number: 7,
					pull_request: {
						url: "https://api.github.com/repos/stylessh/havana/pulls/7",
					},
				},
			}),
		).toEqual(["notifications", "pull:stylessh/havana#7"]);
	});

	it("maps plain issues webhook events to issue list and detail signals", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("issues", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
				issue: {
					number: 9,
				},
			}),
		).toEqual([
			"issues.mine",
			"notifications",
			"repoMeta:stylessh/havana",
			"issue:stylessh/havana#9",
		]);
	});

	it("maps push webhook events to repo metadata and code signals", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("push", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
			}),
		).toEqual([
			"notifications",
			"repoMeta:stylessh/havana",
			"repoCode:stylessh/havana",
		]);
	});

	it("extracts pull signals from check_run webhook payloads", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("check_run", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
				check_run: {
					pull_requests: [{ number: 3 }, { number: 5 }],
				},
			}),
		).toEqual(["pull:stylessh/havana#3", "pull:stylessh/havana#5"]);
	});

	it("maps workflow_run webhook events to repo and run signals", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("workflow_run", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
				workflow_run: {
					id: 101,
				},
			}),
		).toEqual([
			"notifications",
			"actions:stylessh/havana",
			"workflowRun:stylessh/havana#101",
		]);
	});

	it("maps workflow_job webhook events to repo, run, and job signals", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("workflow_job", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
				workflow_job: {
					id: 202,
					run_id: 101,
				},
			}),
		).toEqual([
			"notifications",
			"actions:stylessh/havana",
			"workflowRun:stylessh/havana#101",
			"workflowJob:stylessh/havana#202",
		]);
	});

	it("maps repository_ruleset events to repo protection signal", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("repository_ruleset", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
			}),
		).toEqual(["notifications", "repoProtection:stylessh/havana"]);
	});

	it("maps branch_protection_rule events to repo protection signal", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("branch_protection_rule", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
			}),
		).toEqual(["notifications", "repoProtection:stylessh/havana"]);
	});

	it("maps status events to repo statuses signal", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("status", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
				sha: "abc123",
			}),
		).toEqual(["notifications", "repoStatuses:stylessh/havana"]);
	});

	it("extracts pull signals from workflow_run payloads alongside run entity", () => {
		expect(
			getGitHubWebhookRevalidationSignalKeys("workflow_run", {
				repository: {
					name: "havana",
					owner: { login: "stylessh" },
				},
				workflow_run: {
					id: 55,
					pull_requests: [{ number: 17 }, { number: 19 }],
				},
			}),
		).toEqual([
			"notifications",
			"actions:stylessh/havana",
			"workflowRun:stylessh/havana#55",
			"pull:stylessh/havana#17",
			"pull:stylessh/havana#19",
		]);
	});
});
