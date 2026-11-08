import { describe, expect, it } from "vitest";
import {
	formatEntityKey,
	type GitHubChangeEntity,
	getWebhookChangeEntities,
	getWebhookRepository,
	parseEntityKey,
} from "./github-change-entities";

const repository = {
	name: "Api",
	full_name: "Acme/Api",
	private: true,
	owner: { login: "Acme" },
};

const keys = (event: string, payload: unknown) =>
	getWebhookChangeEntities(event, payload).map(formatEntityKey);

describe("parseEntityKey / formatEntityKey", () => {
	const samples = [
		"pull:acme/api#12",
		"issue:acme/api#4",
		"repo:acme/api",
		"checks:acme/api@abcdef1",
		"run:acme/api#123456",
		"release:acme/api",
		"labels:acme/api",
		"milestones:acme/api",
		"collaborators:acme/api",
		"discussions:acme/api",
	];

	it("round-trips every kind", () => {
		for (const key of samples) {
			const parsed = parseEntityKey(key) as GitHubChangeEntity;
			expect(parsed).not.toBeNull();
			expect(formatEntityKey(parsed)).toBe(key);
		}
	});

	it("rejects malformed keys", () => {
		for (const key of [
			"pull:acme#1",
			"pull:acme/api",
			"checks:acme/api@zzz",
			"unknown:acme/api",
			"repo:acme/api/extra",
			"",
		]) {
			expect(parseEntityKey(key)).toBeNull();
		}
	});
});

describe("getWebhookRepository", () => {
	it("lowercases and treats missing visibility as private", () => {
		expect(getWebhookRepository({ repository })).toEqual({
			fullName: "acme/api",
			isPrivate: true,
		});
		expect(
			getWebhookRepository({
				repository: { name: "x", owner: { login: "o" } },
			})?.isPrivate,
		).toBe(true);
		expect(
			getWebhookRepository({
				repository: { name: "x", owner: { login: "o" }, private: false },
			})?.isPrivate,
		).toBe(false);
		expect(getWebhookRepository({})).toBeNull();
	});
});

describe("getWebhookChangeEntities", () => {
	it("pull_request opened", () => {
		expect(
			keys("pull_request", {
				action: "opened",
				repository,
				pull_request: { number: 12 },
			}),
		).toEqual(["pull:acme/api#12"]);
	});

	it("pull_request synchronize also touches the repo code", () => {
		expect(
			keys("pull_request", {
				action: "synchronize",
				repository,
				pull_request: { number: 12 },
			}),
		).toEqual(["pull:acme/api#12", "repo:acme/api"]);
	});

	it("reviews, review comments and threads target the pull", () => {
		for (const event of [
			"pull_request_review",
			"pull_request_review_comment",
			"pull_request_review_thread",
		]) {
			expect(
				keys(event, { repository, pull_request: { number: 7 } }),
			).toContain("pull:acme/api#7");
		}
	});

	it("issue comments on pull requests target the pull", () => {
		expect(
			keys("issue_comment", {
				repository,
				issue: { number: 7, pull_request: { url: "…" } },
			}),
		).toEqual(["pull:acme/api#7"]);
		expect(
			keys("issues", { action: "labeled", repository, issue: { number: 4 } }),
		).toEqual(["issue:acme/api#4"]);
	});

	it("push, create, delete and repository settings target the repo", () => {
		for (const event of [
			"push",
			"create",
			"delete",
			"repository",
			"branch_protection_rule",
			"repository_ruleset",
		]) {
			expect(keys(event, { repository })).toEqual(["repo:acme/api"]);
		}
	});

	it("check runs and suites target the commit and their pulls", () => {
		expect(
			keys("check_run", {
				repository,
				check_run: {
					head_sha: "0123456789abcdef0123456789abcdef01234567",
					pull_requests: [{ number: 12 }, { number: 13 }],
				},
			}),
		).toEqual([
			"checks:acme/api@0123456789abcdef0123456789abcdef01234567",
			"pull:acme/api#12",
			"pull:acme/api#13",
		]);
	});

	it("commit statuses target the commit", () => {
		expect(keys("status", { repository, sha: "ABCDEF1" })).toEqual([
			"checks:acme/api@abcdef1",
		]);
	});

	it("workflow runs and jobs target the run and the commit", () => {
		expect(
			keys("workflow_run", {
				action: "completed",
				repository,
				workflow_run: { id: 99, head_sha: "abcdef1" },
			}),
		).toEqual(["run:acme/api#99", "checks:acme/api@abcdef1"]);
		expect(
			keys("workflow_job", {
				action: "in_progress",
				repository,
				workflow_job: { id: 5, run_id: 99, head_sha: "abcdef1" },
			}),
		).toEqual(["run:acme/api#99", "checks:acme/api@abcdef1"]);
	});

	it("releases, labels, members and discussions", () => {
		expect(keys("release", { repository })).toEqual(["release:acme/api"]);
		expect(keys("label", { repository })).toEqual(["labels:acme/api"]);
		expect(keys("milestone", { repository })).toEqual(["milestones:acme/api"]);
		expect(keys("member", { repository })).toEqual(["collaborators:acme/api"]);
		expect(keys("discussion", { repository })).toEqual([
			"discussions:acme/api",
		]);
	});

	it("ignores events nothing reads, installations and malformed payloads", () => {
		expect(keys("star", { repository })).toEqual([]);
		expect(keys("fork", { repository })).toEqual([]);
		expect(keys("installation", { installation: { id: 1 } })).toEqual([]);
		expect(keys("pull_request", { repository })).toEqual([]);
		expect(keys("pull_request", { pull_request: { number: 1 } })).toEqual([]);
		expect(keys("push", null)).toEqual([]);
	});
});
