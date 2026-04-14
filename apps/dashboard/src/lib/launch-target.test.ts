import { describe, expect, it } from "vitest";
import { classifyLaunchPath, resolveLaunchTarget } from "./launch-target";

describe("classifyLaunchPath", () => {
	it("classifies repo routes as repo tabs", () => {
		expect(classifyLaunchPath("/stylessh/diffkit")).toEqual({
			id: "repo:stylessh/diffkit",
			type: "repo",
			repo: "stylessh/diffkit",
		});
	});

	it("classifies pull detail routes as pull tabs", () => {
		expect(classifyLaunchPath("/stylessh/diffkit/pull/42")).toEqual({
			id: "pull:stylessh/diffkit#42",
			type: "pull",
			repo: "stylessh/diffkit",
			number: 42,
		});
	});

	it("classifies issue detail routes as issue tabs", () => {
		expect(classifyLaunchPath("/stylessh/diffkit/issues/77")).toEqual({
			id: "issue:stylessh/diffkit#77",
			type: "issue",
			repo: "stylessh/diffkit",
			number: 77,
		});
	});

	it("classifies review routes as review tabs", () => {
		expect(classifyLaunchPath("/stylessh/diffkit/review/9")).toEqual({
			id: "review:stylessh/diffkit#9",
			type: "review",
			repo: "stylessh/diffkit",
			number: 9,
		});
	});

	it("returns null for non-tab routes", () => {
		expect(classifyLaunchPath("/pulls")).toBeNull();
		expect(classifyLaunchPath("/stylessh")).toBeNull();
		expect(classifyLaunchPath("/stylessh/diffkit/issues/new")).toBeNull();
	});

	it("returns null for malformed numeric segments", () => {
		expect(
			classifyLaunchPath("/stylessh/diffkit/pull/not-a-number"),
		).toBeNull();
		expect(classifyLaunchPath("/stylessh/diffkit/review/0")).toBeNull();
	});
});

describe("resolveLaunchTarget", () => {
	it("keeps same-origin route with search and hash", () => {
		expect(
			resolveLaunchTarget(
				"https://diff-kit.com/stylessh/diffkit/pull/42?tab=files#diff-1",
			),
		).toEqual({
			to: "/stylessh/diffkit/pull/42?tab=files#diff-1",
			tab: {
				id: "pull:stylessh/diffkit#42",
				type: "pull",
				repo: "stylessh/diffkit",
				number: 42,
			},
		});
	});

	it("returns null for relative launch targets", () => {
		expect(
			resolveLaunchTarget("/stylessh/diffkit/issues/77?pane=activity#event-1"),
		).toBeNull();
	});

	it("returns non-tab targets for same-origin non-tab routes", () => {
		expect(
			resolveLaunchTarget("https://diff-kit.com/pulls?state=open#mine"),
		).toEqual({
			to: "/pulls?state=open#mine",
			tab: null,
		});
	});

	it("normalizes absolute URLs by path even when origin differs", () => {
		expect(
			resolveLaunchTarget("https://github.com/stylessh/diffkit/pull/42"),
		).toEqual({
			to: "/stylessh/diffkit/pull/42",
			tab: {
				id: "pull:stylessh/diffkit#42",
				type: "pull",
				repo: "stylessh/diffkit",
				number: 42,
			},
		});
	});

	it("returns null for invalid inputs", () => {
		expect(resolveLaunchTarget(undefined)).toBeNull();
		expect(resolveLaunchTarget(42)).toBeNull();
		expect(resolveLaunchTarget("not a url")).toBeNull();
	});
});
