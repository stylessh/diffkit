import { describe, expect, it } from "vitest";
import { mapPullReviewers } from "./pull-reviewers";

const bot = (login: string) => ({
	__typename: "Bot",
	login,
	avatarUrl: `https://avatars.example/${login}`,
	url: `https://github.com/apps/${login}`,
});

describe("mapPullReviewers", () => {
	it("lists an app that reviewed without being requested", () => {
		const { requestedReviewers, reviewedBy } = mapPullReviewers(
			[],
			[{ state: "COMMENTED", author: bot("coderabbitai") }],
		);

		expect(requestedReviewers).toEqual([]);
		expect(reviewedBy).toEqual([
			{
				login: "coderabbitai[bot]",
				avatarUrl: "https://avatars.example/coderabbitai",
				url: "https://github.com/apps/coderabbitai",
				type: "Bot",
				reviewState: "commented",
			},
		]);
	});

	it("keeps a requested app, under the login the reviewer picker uses", () => {
		const { requestedReviewers } = mapPullReviewers(
			[{ requestedReviewer: bot("copilot-pull-request-reviewer") }],
			[],
		);

		expect(requestedReviewers.map((reviewer) => reviewer.login)).toEqual([
			"copilot-pull-request-reviewer[bot]",
		]);
	});

	it("separates teams from people and leaves out pending reviews", () => {
		const result = mapPullReviewers(
			[
				{
					requestedReviewer: {
						__typename: "Team",
						name: "Core",
						slug: "core",
						url: "https://github.com/orgs/acme/teams/core",
					},
				},
				{
					requestedReviewer: {
						__typename: "User",
						login: "ada",
						avatarUrl: "a",
						url: "https://github.com/ada",
					},
				},
			],
			[
				{
					state: "APPROVED",
					author: {
						__typename: "User",
						login: "lin",
						avatarUrl: "l",
						url: "u",
					},
				},
				{
					state: "PENDING",
					author: {
						__typename: "User",
						login: "viewer",
						avatarUrl: "v",
						url: "u",
					},
				},
			],
		);

		expect(result.requestedTeams.map((team) => team.slug)).toEqual(["core"]);
		expect(result.requestedReviewers.map((reviewer) => reviewer.login)).toEqual(
			["ada"],
		);
		expect(
			result.reviewedBy.map(({ login, reviewState }) => [login, reviewState]),
		).toEqual([["lin", "approved"]]);
	});
});
