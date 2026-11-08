import { describe, expect, it } from "vitest";
import {
	buildPullStackIndex,
	getPullStackContext,
	groupPullsByStack,
	type StackablePull,
	stackablePullFromDetail,
} from "./pull-stack";

const REPO = "acme/app";

function pull(
	number: number,
	base: string,
	head: string,
	overrides: Partial<StackablePull> = {},
): StackablePull {
	return {
		number,
		state: "open",
		baseRefName: base,
		headRefName: head,
		headRepoFullName: REPO,
		updatedAt: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

const build = (pulls: StackablePull[], ignoredBranches?: string[]) =>
	buildPullStackIndex(pulls, { repoFullName: REPO, ignoredBranches });

describe("buildPullStackIndex", () => {
	it("finds no stacks when every PR targets the default branch", () => {
		const index = build([pull(1, "main", "feat-a"), pull(2, "main", "feat-b")]);
		expect(index.stacks).toEqual([]);
		expect(index.stackByNumber.size).toBe(0);
	});

	it("links a linear chain root to leaf", () => {
		const index = build([
			pull(3, "feat-b", "feat-c"),
			pull(1, "main", "feat-a"),
			pull(2, "feat-a", "feat-b"),
		]);
		expect(index.stacks).toHaveLength(1);
		const [stack] = index.stacks;
		expect(stack?.rootNumber).toBe(1);
		expect(
			stack?.entries.map((e) => [e.pull.number, e.depth, e.index]),
		).toEqual([
			[1, 0, 0],
			[2, 1, 1],
			[3, 2, 2],
		]);
		expect(index.parentByNumber.get(3)).toBe(2);
		expect(index.parentByNumber.has(1)).toBe(false);
	});

	it("handles branching stacks in depth-first order", () => {
		const index = build([
			pull(1, "main", "a"),
			pull(2, "a", "b"),
			pull(3, "a", "c"),
			pull(4, "b", "d"),
		]);
		const [stack] = index.stacks;
		expect(stack?.entries.map((e) => [e.pull.number, e.depth])).toEqual([
			[1, 0],
			[2, 1],
			[4, 2],
			[3, 1],
		]);
	});

	it("keeps unrelated stacks separate", () => {
		const index = build([
			pull(1, "main", "a"),
			pull(2, "a", "b"),
			pull(10, "main", "x"),
			pull(11, "x", "y"),
			pull(20, "main", "solo"),
		]);
		expect(index.stacks.map((s) => s.rootNumber)).toEqual([1, 10]);
		expect(index.stackByNumber.has(20)).toBe(false);
	});

	it("ignores closed and merged PRs", () => {
		const index = build([
			pull(1, "main", "a", { state: "closed" }),
			pull(2, "a", "b"),
		]);
		expect(index.stacks).toEqual([]);
	});

	it("does not treat a fork branch with the same name as a parent", () => {
		const index = build([
			pull(1, "main", "main", { headRepoFullName: "someone/app" }),
			pull(2, "main", "feature"),
		]);
		expect(index.stacks).toEqual([]);
	});

	it("never uses PRs with an unknown head repository as a parent", () => {
		const index = build([
			pull(1, "main", "a", { headRepoFullName: null }),
			pull(2, "a", "b"),
		]);
		expect(index.stacks).toEqual([]);
	});

	it("compares repository names case-insensitively", () => {
		const index = build([
			pull(1, "main", "a", { headRepoFullName: "Acme/App" }),
			pull(2, "a", "b"),
		]);
		expect(index.stacks).toHaveLength(1);
	});

	it("skips ignored branches such as a PR opened from the default branch", () => {
		const pulls = [pull(1, "release", "main"), pull(2, "main", "feat")];
		expect(build(pulls).stacks).toHaveLength(1);
		expect(build(pulls, ["main"]).stacks).toEqual([]);
	});

	it("ignores PRs missing branch information", () => {
		const index = build([{ number: 1, state: "open" }, pull(2, "main", "b")]);
		expect(index.stacks).toEqual([]);
	});

	it("never makes a PR its own parent", () => {
		const index = build([pull(1, "same", "same")]);
		expect(index.stacks).toEqual([]);
	});

	it("breaks two-PR cycles deterministically", () => {
		const index = build([pull(1, "b", "a"), pull(2, "a", "b")]);
		expect(index.stacks).toHaveLength(1);
		const [stack] = index.stacks;
		expect(stack?.entries).toHaveLength(2);
		expect(stack?.rootNumber).toBe(2);
		expect(index.parentByNumber.get(1)).toBe(2);
	});

	it("picks the most recently updated parent when head branches collide", () => {
		const index = build([
			pull(1, "main", "shared", { updatedAt: "2026-01-01T00:00:00Z" }),
			pull(2, "release", "shared", { updatedAt: "2026-02-01T00:00:00Z" }),
			pull(3, "shared", "child"),
		]);
		expect(index.parentByNumber.get(3)).toBe(2);
	});
});

describe("getPullStackContext", () => {
	const index = build([
		pull(1, "main", "a"),
		pull(2, "a", "b"),
		pull(3, "b", "c"),
		pull(4, "b", "d"),
	]);

	it("returns null for PRs outside a stack", () => {
		expect(getPullStackContext(index, 99)).toBeNull();
	});

	it("reports ancestors, parent, children and position for a middle PR", () => {
		const context = getPullStackContext(index, 2);
		expect(context?.ancestors.map((p) => p.number)).toEqual([1]);
		expect(context?.parent?.number).toBe(1);
		expect(context?.children.map((p) => p.number)).toEqual([3, 4]);
		expect(context?.position).toBe(2);
		expect(context?.size).toBe(4);
	});

	it("reports no parent for the root and no children for a leaf", () => {
		expect(getPullStackContext(index, 1)?.parent).toBeNull();
		expect(getPullStackContext(index, 1)?.position).toBe(1);
		const leaf = getPullStackContext(index, 4);
		expect(leaf?.children).toEqual([]);
		expect(leaf?.ancestors.map((p) => p.number)).toEqual([1, 2]);
		expect(leaf?.position).toBe(4);
	});
});

describe("groupPullsByStack", () => {
	const pulls = [
		pull(20, "main", "solo"),
		pull(2, "a", "b"),
		pull(1, "main", "a"),
		pull(3, "b", "c"),
	];
	const index = build(pulls);

	it("emits a stack at the position of its first visible member", () => {
		const items = groupPullsByStack(pulls, index);
		expect(items.map((item) => item.kind)).toEqual(["pull", "stack"]);
		const stackItem = items[1];
		expect(stackItem?.kind === "stack" && stackItem.size).toBe(3);
		expect(
			stackItem?.kind === "stack" &&
				stackItem.entries.map((e) => [e.pull.number, e.depth]),
		).toEqual([
			[1, 0],
			[2, 1],
			[3, 2],
		]);
	});

	it("keeps only visible members and keeps full-stack depth", () => {
		const visible = pulls.filter((p) => p.number !== 2);
		const items = groupPullsByStack(visible, index);
		const stackItem = items.find((item) => item.kind === "stack");
		expect(
			stackItem?.kind === "stack" &&
				stackItem.entries.map((e) => [e.pull.number, e.depth]),
		).toEqual([
			[1, 0],
			[3, 2],
		]);
		expect(stackItem?.kind === "stack" && stackItem.size).toBe(3);
	});

	it("degrades to a plain row when only one member is visible", () => {
		const items = groupPullsByStack([pulls[2] as StackablePull], index);
		expect(items).toEqual([{ kind: "pull", pull: pulls[2] }]);
	});
});

describe("stackablePullFromDetail", () => {
	it("prefers an explicit head repository", () => {
		const result = stackablePullFromDetail(
			{
				number: 1,
				state: "open",
				baseRefName: "main",
				headRefName: "a",
				headRepoFullName: "fork/app",
				headRepoOwner: "acme",
			},
			REPO,
		);
		expect(result.headRepoFullName).toBe("fork/app");
	});

	it("infers the base repository from a matching head owner", () => {
		expect(
			stackablePullFromDetail(
				{ number: 1, state: "open", headRepoOwner: "Acme" },
				REPO,
			).headRepoFullName,
		).toBe(REPO);
		expect(
			stackablePullFromDetail(
				{ number: 1, state: "open", headRepoOwner: "fork" },
				REPO,
			).headRepoFullName,
		).toBeNull();
		expect(
			stackablePullFromDetail({ number: 1, state: "open" }, REPO)
				.headRepoFullName,
		).toBeNull();
	});
});
