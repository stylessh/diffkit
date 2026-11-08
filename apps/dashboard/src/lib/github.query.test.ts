import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
	githubQueryEntityCoverage,
	githubQueryKeys,
	githubQueryMatchesEntity,
	githubQueryPath,
	queryFiltersForEntity,
} from "./github.query";
import {
	type GitHubChangeEntity,
	parseEntityKey,
} from "./github-change-entities";

const scope = { userId: "u1" };
const sampleInput = {
	owner: "Acme",
	repo: "Api",
	pullNumber: 12,
	issueNumber: 12,
	runId: 99,
	jobId: 5,
	sha: "abcdef1",
	ref: "main",
	path: "src/a.ts",
	dirPath: "",
	base: "main",
	head: "feat",
	kind: "issue",
	page: 1,
	org: "acme",
	tag: "v1",
};

/** Every query key builder in githubQueryKeys, called with a sample input. */
function allSampleKeys(): (readonly unknown[])[] {
	const keys: (readonly unknown[])[] = [];
	const walk = (node: unknown) => {
		if (typeof node === "function") {
			keys.push(
				(node as (s: unknown, i: unknown) => readonly unknown[])(
					scope,
					sampleInput,
				),
			);
		} else if (node && typeof node === "object" && !Array.isArray(node)) {
			for (const child of Object.values(node)) walk(child);
		}
	};
	walk(githubQueryKeys);
	return keys;
}

const samples: Record<string, GitHubChangeEntity> = {
	org: { kind: "org", org: "acme" },
	pull: { kind: "pull", repo: "acme/api", number: 12 },
	issue: { kind: "issue", repo: "acme/api", number: 12 },
	repo: { kind: "repo", repo: "acme/api" },
	checks: { kind: "checks", repo: "acme/api", sha: "abcdef1" },
	run: { kind: "run", repo: "acme/api", runId: 99 },
	release: { kind: "release", repo: "acme/api" },
	labels: { kind: "labels", repo: "acme/api" },
	milestones: { kind: "milestones", repo: "acme/api" },
	collaborators: { kind: "collaborators", repo: "acme/api" },
	discussions: { kind: "discussions", repo: "acme/api" },
	settings: { kind: "settings", repo: "acme/api" },
};

/** Cached payload of an aggregate that contains the sample item. */
const aggregateData = [
	{
		number: 12,
		fullName: "acme/api",
		repository: { owner: "acme", name: "api" },
	},
];

describe("entity → query registry", () => {
	it("covers every githubQueryKeys group or marks it exempt", () => {
		expect(allSampleKeys().length).toBeGreaterThan(60);
		const paths = new Set(allSampleKeys().map((key) => githubQueryPath(key)));
		for (const path of paths) {
			expect(path, "query path").not.toBeNull();
			expect(
				githubQueryEntityCoverage,
				`githubQueryEntityCoverage is missing "${path}"`,
			).toHaveProperty([path as string]);
		}
		for (const path of Object.keys(githubQueryEntityCoverage)) {
			expect(paths, `stale coverage entry "${path}"`).toContain(path);
		}
	});

	it("every covered group matches an entity of each kind it lists", () => {
		for (const key of allSampleKeys()) {
			const path = githubQueryPath(key) as string;
			const kinds = githubQueryEntityCoverage[path];
			if (kinds === "exempt") continue;
			for (const kind of kinds) {
				expect(
					githubQueryMatchesEntity(key, samples[kind], aggregateData),
					`${path} should match ${kind}`,
				).toBe(true);
			}
		}
	});

	it("refetches code at a branch on push, but never code pinned to a commit", () => {
		const push = { kind: "repo", repo: "acme/api" } as const;
		const input = { owner: "acme", repo: "api", path: "src/a.ts" };
		expect(
			githubQueryMatchesEntity(
				githubQueryKeys.code.blob(scope, { ...input, ref: "main" }),
				push,
			),
		).toBe(true);
		expect(
			githubQueryMatchesEntity(
				githubQueryKeys.code.blame(scope, { ...input, ref: "a".repeat(40) }),
				push,
			),
		).toBe(false);
	});

	it("targets one pull, not its neighbours or other repos", () => {
		const page = githubQueryKeys.pulls.page(scope, {
			owner: "acme",
			repo: "api",
			pullNumber: 12,
		});
		const other = githubQueryKeys.pulls.page(scope, {
			owner: "acme",
			repo: "api",
			pullNumber: 13,
		});
		const otherRepo = githubQueryKeys.pulls.page(scope, {
			owner: "acme",
			repo: "web",
			pullNumber: 12,
		});
		expect(githubQueryMatchesEntity(page, samples.pull)).toBe(true);
		expect(githubQueryMatchesEntity(other, samples.pull)).toBe(false);
		expect(githubQueryMatchesEntity(otherRepo, samples.pull)).toBe(false);
		expect(githubQueryMatchesEntity(page, samples.issue)).toBe(false);
		expect(
			githubQueryMatchesEntity(githubQueryKeys.viewer(scope), samples.pull),
		).toBe(false);
	});

	it("targets one organization, not another or a repository", () => {
		const members = githubQueryKeys.orgSettings.members(scope, { org: "Acme" });
		const other = githubQueryKeys.orgSettings.members(scope, { org: "globex" });
		expect(githubQueryMatchesEntity(members, samples.org)).toBe(true);
		expect(githubQueryMatchesEntity(other, samples.org)).toBe(false);
		expect(
			githubQueryMatchesEntity(
				githubQueryKeys.repoSettings.access(scope, {
					owner: "acme",
					repo: "api",
				}),
				samples.org,
			),
		).toBe(false);
		expect(parseEntityKey("org:Acme")).toEqual(samples.org);
	});

	it("refetches user-wide aggregates only when they contain the item", () => {
		const mine = githubQueryKeys.pulls.mine(scope);
		expect(githubQueryMatchesEntity(mine, samples.pull, aggregateData)).toBe(
			true,
		);
		expect(
			githubQueryMatchesEntity(
				mine,
				{ kind: "pull", repo: "acme/api", number: 77 },
				aggregateData,
			),
		).toBe(false);
		expect(
			githubQueryMatchesEntity(mine, samples.pull, {
				reviewRequested: aggregateData,
				assigned: [],
			}),
		).toBe(true);
	});

	it("refetches the inbox only for items it lists", () => {
		const inbox = githubQueryKeys.notifications.list(scope, {});
		const data = {
			notifications: [
				{
					repository: { fullName: "Acme/Api", owner: { login: "Acme" } },
					subject: { url: "https://api.github.com/repos/Acme/Api/pulls/12" },
				},
			],
		};
		expect(githubQueryMatchesEntity(inbox, samples.pull, data)).toBe(true);
		expect(
			githubQueryMatchesEntity(
				inbox,
				{ kind: "pull", repo: "acme/api", number: 13 },
				data,
			),
		).toBe(false);
		expect(githubQueryMatchesEntity(inbox, samples.repo, data)).toBe(false);
	});

	it("refetches user-wide aggregates for an item the viewer just created", () => {
		const created = { kind: "pull", repo: "acme/api", number: 77 } as const;
		const otherPull = githubQueryKeys.pulls.page(scope, {
			owner: "acme",
			repo: "api",
			pullNumber: 12,
		});
		expect(
			githubQueryMatchesEntity(
				githubQueryKeys.pulls.mine(scope),
				created,
				aggregateData,
				"created",
			),
		).toBe(true);
		expect(
			githubQueryMatchesEntity(otherPull, created, undefined, "created"),
		).toBe(false);
	});

	it("queryFiltersForEntity invalidates only matching queries of the user", async () => {
		const queryClient = new QueryClient();
		const hit = githubQueryKeys.pulls.page(scope, {
			owner: "acme",
			repo: "api",
			pullNumber: 12,
		});
		const miss = githubQueryKeys.pulls.page(scope, {
			owner: "acme",
			repo: "api",
			pullNumber: 13,
		});
		const otherUser = githubQueryKeys.pulls.page(
			{ userId: "u2" },
			{ owner: "acme", repo: "api", pullNumber: 12 },
		);
		for (const key of [hit, miss, otherUser]) queryClient.setQueryData(key, 1);

		await queryClient.invalidateQueries(
			queryFiltersForEntity("pull:acme/api#12", scope),
		);
		expect(queryClient.getQueryState(hit)?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(miss)?.isInvalidated).toBe(false);
		expect(queryClient.getQueryState(otherUser)?.isInvalidated).toBe(false);
	});

	it("ignores unparseable entity keys", () => {
		expect(parseEntityKey("garbage")).toBeNull();
		const filters = queryFiltersForEntity("garbage", scope);
		expect(
			filters.predicate({
				queryKey: githubQueryKeys.pulls.mine(scope),
				state: { data: aggregateData },
			}),
		).toBe(false);
	});
});
