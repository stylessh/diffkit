import { describe, expect, it } from "vitest";
import { resolveCreateTarget } from "./create-actions";

const beacon = { owner: "lumen-labs", name: "beacon" };

describe("resolveCreateTarget", () => {
	it("asks for a repository when the page has none", () => {
		expect(resolveCreateTarget("new-issue", null, "compare")).toEqual({
			kind: "pick-repo",
			action: "new-issue",
		});
	});

	it("routes each action to its page in the current repository", () => {
		expect(resolveCreateTarget("new-issue", beacon, "compare")).toEqual({
			kind: "navigate",
			to: "/lumen-labs/beacon/issues/new",
		});
		expect(resolveCreateTarget("new-release", beacon, "compare")).toEqual({
			kind: "navigate",
			to: "/lumen-labs/beacon/releases/new",
		});
		expect(resolveCreateTarget("new-pull", beacon, "compare")).toEqual({
			kind: "navigate",
			to: "/lumen-labs/beacon/compare",
		});
	});

	it("sends new pull requests to the branches page when compare has no index route", () => {
		expect(resolveCreateTarget("new-pull", beacon, "branches")).toEqual({
			kind: "navigate",
			to: "/lumen-labs/beacon/branches",
		});
	});
});
