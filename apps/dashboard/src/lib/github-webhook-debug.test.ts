import { describe, expect, it } from "vitest";
import { getGitHubWebhookPayloadMetadata } from "./github-webhook-debug";

describe("getGitHubWebhookPayloadMetadata", () => {
	it("returns compact metadata for object payloads", () => {
		expect(
			getGitHubWebhookPayloadMetadata({
				action: "opened",
				repository: {
					name: "rabat",
					owner: { login: "adn" },
				},
				sender: {
					login: "octocat",
				},
				installation: {
					id: 77,
				},
				pull_request: {
					number: 42,
				},
			}),
		).toEqual({
			payloadType: "object",
			payloadKeys: [
				"action",
				"installation",
				"pull_request",
				"repository",
				"sender",
			],
			action: "opened",
			repository: "adn/rabat",
			sender: "octocat",
			installationId: 77,
			pullNumber: 42,
			issueNumber: undefined,
			workflowRunId: undefined,
			workflowJobId: undefined,
			checkRunId: undefined,
			checkSuiteId: undefined,
		});
	});

	it("returns array metadata without logging item contents", () => {
		expect(getGitHubWebhookPayloadMetadata([{ id: 1 }, { id: 2 }])).toEqual({
			payloadType: "array",
			itemCount: 2,
		});
	});

	it("returns primitive metadata without leaking values", () => {
		expect(getGitHubWebhookPayloadMetadata("raw-body")).toEqual({
			payloadType: "string",
		});
	});
});
