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
		).toEqual(["pull:stylessh/havana#7"]);
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
		).toEqual(["repoMeta:stylessh/havana", "repoCode:stylessh/havana"]);
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
		).toEqual(["actions:stylessh/havana", "workflowRun:stylessh/havana#101"]);
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
			"actions:stylessh/havana",
			"workflowRun:stylessh/havana#101",
			"workflowJob:stylessh/havana#202",
		]);
	});
});
