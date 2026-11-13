import { Octokit } from "octokit";
import { describe, expect, it } from "vitest";
import { repoInputValidator } from "./validators";

describe("repoInputValidator", () => {
	it("keeps request options sent by the caller out of the Octokit call", async () => {
		const requests: string[] = [];
		const octokit = new Octokit({
			auth: "test-token",
			retry: { enabled: false },
			throttle: { enabled: false },
			request: {
				fetch: async (url: string, init: { method: string }) => {
					requests.push(`${init.method} ${url}`);
					return new Response("{}", {
						headers: { "content-type": "application/json" },
					});
				},
			},
		});
		const fromRequest = {
			owner: "acme",
			repo: "widgets",
			baseUrl: "https://elsewhere.example",
			url: "https://elsewhere.example/collect",
			method: "DELETE",
			headers: { accept: "text/plain" },
		};

		await octokit.rest.repos.get(repoInputValidator(fromRequest));

		expect(requests).toEqual(["GET https://api.github.com/repos/acme/widgets"]);
	});

	it("accepts the characters GitHub allows in owner and repository names", () => {
		expect(repoInputValidator({ owner: "my-org", repo: ".github" })).toEqual({
			owner: "my-org",
			repo: ".github",
		});
		expect(repoInputValidator({ owner: "acme", repo: "widgets_v2.1" })).toEqual(
			{ owner: "acme", repo: "widgets_v2.1" },
		);
	});

	it.each([
		["a missing repository", { owner: "acme" }],
		["an object in place of a name", { owner: { login: "acme" }, repo: "r" }],
		["a path segment that walks up", { owner: "acme", repo: ".." }],
		["a name with a slash", { owner: "acme", repo: "widgets/hooks" }],
		["an empty name", { owner: "", repo: "widgets" }],
		["a name longer than GitHub allows", { owner: "a".repeat(101), repo: "r" }],
		["no input at all", undefined],
	])("rejects %s", (_label, input) => {
		expect(() => repoInputValidator(input as never)).toThrow(
			"Invalid repository.",
		);
	});
});
