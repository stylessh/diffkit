import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubAppInstallation } from "../github-access";
import { GitHubOperationTimeoutError } from "./client";
import { getMyPullsResult } from "./my-search";
import type { GitHubGraphQLSearchSource } from "./my-search-sources";
import type { GitHubContext } from "./shared";

const sources = vi.hoisted(() => ({
	list: [] as GitHubGraphQLSearchSource[],
	persistForbiddenOrgs: vi.fn(async () => {}),
	/** Repositories GitHub confirms the viewer can read. */
	viewerReadable: [] as string[],
	viewerChecks: [] as string[],
}));

vi.mock("./installations", async (importOriginal) => ({
	...(await importOriginal<typeof import("./installations")>()),
	viewerCanReadInstallationRepository: async (
		_context: GitHubContext,
		_installation: GitHubAppInstallation,
		{ owner, repo }: { owner: string; repo: string },
	) => {
		sources.viewerChecks.push(`${owner}/${repo}`);
		return sources.viewerReadable.includes(`${owner}/${repo}`);
	},
}));

vi.mock("cloudflare:workers", () => ({ env: {} }));

vi.mock("./my-search-sources", async (importOriginal) => ({
	...(await importOriginal<typeof import("./my-search-sources")>()),
	getMySearchSources: async () => sources.list,
	persistForbiddenOrgs: sources.persistForbiddenOrgs,
}));

function pullNode(
	number: number,
	updatedAt: string,
	repository: { name: string; isPrivate: boolean } = {
		name: "api",
		isPrivate: false,
	},
) {
	return {
		__typename: "PullRequest",
		databaseId: number,
		number,
		title: `Pull ${number}`,
		state: "OPEN",
		isDraft: false,
		createdAt: updatedAt,
		updatedAt,
		closedAt: null,
		mergedAt: null,
		url: `https://github.com/acme/api/pull/${number}`,
		additions: 1,
		deletions: 0,
		comments: { totalCount: 0 },
		author: null,
		labels: null,
		repository: {
			name: repository.name,
			nameWithOwner: `acme/${repository.name}`,
			url: `https://github.com/acme/${repository.name}`,
			isPrivate: repository.isPrivate,
			owner: { login: "acme" },
		},
	};
}

const acmeInstallation: GitHubAppInstallation = {
	id: 1,
	account: {
		id: 10,
		login: "acme",
		name: null,
		avatarUrl: null,
		type: "Organization",
	},
	targetType: "Organization",
	repositorySelection: "all",
	manageUrl: null,
	suspendedAt: null,
};

function source(
	label: string,
	graphql: (document: string, variables: Record<string, unknown>) => unknown,
	installation?: GitHubAppInstallation,
): GitHubGraphQLSearchSource {
	return {
		label,
		installation,
		context: {
			session: { user: { id: "u1" } },
			octokit: {
				graphql: vi.fn(async (...args) =>
					graphql(...(args as [string, Record<string, unknown>])),
				),
			},
		} as unknown as GitHubContext,
	};
}

const emptyBuckets = {
	reviewRequested: { nodes: [] },
	assigned: { nodes: [] },
	authored: { nodes: [] },
	mentioned: { nodes: [] },
	involved: { nodes: [] },
};

const context = {
	session: { user: { id: "u1" } },
} as unknown as GitHubContext;

describe("getMyPullsResult", () => {
	beforeEach(() => {
		sources.persistForbiddenOrgs.mockClear();
		sources.viewerReadable = [];
		sources.viewerChecks = [];
	});

	it("merges every source and keeps the newest copy of a pull request", async () => {
		const queries: Record<string, unknown>[] = [];
		sources.list = [
			source("installation:1:acme", (_document, variables) => {
				queries.push(variables);
				return {
					...emptyBuckets,
					authored: { nodes: [pullNode(1, "2026-11-01T00:00:00Z")] },
				};
			}),
			source("oauth:fallback", () => ({
				...emptyBuckets,
				authored: {
					nodes: [
						pullNode(1, "2026-11-02T00:00:00Z"),
						pullNode(2, "2026-10-01T00:00:00Z"),
					],
				},
			})),
		];

		const result = await getMyPullsResult({ context, username: "nova" });

		expect(
			result.authored.map((pull) => [pull.number, pull.updatedAt]),
		).toEqual([
			[1, "2026-11-02T00:00:00Z"],
			[2, "2026-10-01T00:00:00Z"],
		]);
		expect(result.partial).toBeUndefined();
		expect(queries[0]).toMatchObject({
			authoredQuery: "is:pr is:open author:nova archived:false",
			reviewRequestedQuery:
				"is:pr is:open user-review-requested:nova archived:false",
		});
	});

	it("returns what loaded when a source times out or is blocked by its organization", async () => {
		sources.list = [
			source("installation:1:acme", () => ({
				...emptyBuckets,
				assigned: { nodes: [pullNode(3, "2026-11-01T00:00:00Z")] },
			})),
			source("installation:2:slow", () => {
				throw new GitHubOperationTimeoutError("github pull search", 8_000);
			}),
			source("oauth:fallback", () => {
				throw new Error(
					"Although you appear to have the correct authorization credentials, the `locked` organization has enabled OAuth App access restrictions",
				);
			}),
		];

		const result = await getMyPullsResult({ context, username: "nova" });

		expect(result.assigned.map((pull) => pull.number)).toEqual([3]);
		expect(result).toMatchObject({
			partial: true,
			timedOut: true,
			forbiddenOrgs: ["locked"],
		});
		expect(sources.persistForbiddenOrgs).toHaveBeenCalledWith("u1", ["locked"]);
	});

	it("drops an installation's private repositories GitHub does not confirm for the viewer", async () => {
		sources.viewerReadable = ["acme/billing"];
		sources.list = [
			source(
				"installation:1:acme",
				() => ({
					...emptyBuckets,
					mentioned: {
						nodes: [
							pullNode(1, "2026-11-03T00:00:00Z"),
							pullNode(2, "2026-11-02T00:00:00Z", {
								name: "billing",
								isPrivate: true,
							}),
							pullNode(3, "2026-11-01T00:00:00Z", {
								name: "payroll",
								isPrivate: true,
							}),
						],
					},
				}),
				acmeInstallation,
			),
			source("oauth:fallback", () => ({
				...emptyBuckets,
				authored: {
					nodes: [
						pullNode(4, "2026-10-01T00:00:00Z", {
							name: "notes",
							isPrivate: true,
						}),
					],
				},
			})),
		];

		const result = await getMyPullsResult({ context, username: "nova" });

		expect(result.mentioned.map((pull) => pull.repository.fullName)).toEqual([
			"acme/api",
			"acme/billing",
		]);
		// Read with the viewer's own token, so GitHub already decided.
		expect(result.authored.map((pull) => pull.repository.fullName)).toEqual([
			"acme/notes",
		]);
		expect(sources.viewerChecks.sort()).toEqual([
			"acme/billing",
			"acme/payroll",
		]);
	});
});
