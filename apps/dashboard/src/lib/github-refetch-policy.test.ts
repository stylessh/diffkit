import { afterEach, describe, expect, it, vi } from "vitest";
import { githubCachePolicy } from "./github-cache-policy";
import {
	adaptiveRefetchInterval,
	classifyPullStatus,
	classifyWorkflowJobs,
	classifyWorkflowRun,
	GITHUB_TERMINAL_POLL_STOP_AFTER_MS,
	getAdaptiveRefetchInterval,
	getQueryDataLastChangedAt,
	githubPollIntervalMs,
} from "./github-refetch-policy";

const TEN_MINUTES = GITHUB_TERMINAL_POLL_STOP_AFTER_MS;

describe("getAdaptiveRefetchInterval", () => {
	it("polls fast while something is queued or running", () => {
		expect(
			getAdaptiveRefetchInterval({
				isActive: true,
				isTerminal: false,
				lastChangedAt: 0,
				now: TEN_MINUTES * 5,
			}),
		).toBe(5_000);
	});

	it("polls at the idle rate when nothing is running", () => {
		expect(
			getAdaptiveRefetchInterval({
				isActive: false,
				isTerminal: false,
				lastChangedAt: 0,
				now: TEN_MINUTES * 5,
			}),
		).toBe(30_000);
	});

	it("keeps polling a terminal entity that changed recently", () => {
		expect(
			getAdaptiveRefetchInterval({
				isActive: false,
				isTerminal: true,
				lastChangedAt: 1_000,
				now: 1_000 + TEN_MINUTES - 1,
			}),
		).toBe(30_000);
	});

	it("stops polling a terminal entity unchanged for ten minutes", () => {
		expect(
			getAdaptiveRefetchInterval({
				isActive: false,
				isTerminal: true,
				lastChangedAt: 1_000,
				now: 1_000 + TEN_MINUTES,
			}),
		).toBe(false);
	});
});

describe("classifiers", () => {
	it("classifies workflow runs by status", () => {
		expect(classifyWorkflowRun({ status: "in_progress" })).toEqual({
			isActive: true,
			isTerminal: false,
		});
		expect(classifyWorkflowRun({ status: "queued" })).toEqual({
			isActive: true,
			isTerminal: false,
		});
		expect(classifyWorkflowRun({ status: "completed" })).toEqual({
			isActive: false,
			isTerminal: true,
		});
		expect(classifyWorkflowRun(null)).toEqual({
			isActive: false,
			isTerminal: false,
		});
	});

	it("classifies job lists as active until every job completes", () => {
		expect(
			classifyWorkflowJobs([{ status: "completed" }, { status: "queued" }]),
		).toEqual({ isActive: true, isTerminal: false });
		expect(
			classifyWorkflowJobs([{ status: "completed" }, { status: "completed" }]),
		).toEqual({ isActive: false, isTerminal: true });
		expect(classifyWorkflowJobs([])).toEqual({
			isActive: false,
			isTerminal: false,
		});
	});

	it("classifies PR status by pending checks and PR state", () => {
		const checks = (pending: number) => ({
			checks: {
				total: 3,
				passed: 3 - pending,
				failed: 0,
				pending,
				skipped: 0,
				expected: 0,
			},
		});

		expect(classifyPullStatus(checks(1))).toEqual({
			isActive: true,
			isTerminal: false,
		});
		expect(classifyPullStatus(checks(0))).toEqual({
			isActive: false,
			isTerminal: false,
		});
		expect(classifyPullStatus(checks(0), { isPullClosed: true })).toEqual({
			isActive: false,
			isTerminal: true,
		});
		expect(classifyPullStatus(checks(2), { isPullClosed: true })).toEqual({
			isActive: true,
			isTerminal: false,
		});
	});
});

describe("adaptiveRefetchInterval", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("stops once a completed run has been unchanged for ten minutes", () => {
		vi.useFakeTimers();
		const completedRun = { status: "completed" };
		const query = { state: { data: completedRun, dataUpdatedAt: 1 } };
		const refetchInterval = adaptiveRefetchInterval(classifyWorkflowRun);

		vi.setSystemTime(60_000);
		expect(refetchInterval(query)).toBe(30_000);

		// Identical refetches keep the same data reference (structural sharing),
		// so only `dataUpdatedAt` advances.
		query.state.dataUpdatedAt = TEN_MINUTES;
		vi.setSystemTime(TEN_MINUTES + 1);
		expect(refetchInterval(query)).toBe(false);
	});

	it("restarts the terminal window when the data changes", () => {
		vi.useFakeTimers();
		const query = {
			state: { data: { status: "completed" }, dataUpdatedAt: 1 },
		};
		const refetchInterval = adaptiveRefetchInterval(classifyWorkflowRun);
		expect(getQueryDataLastChangedAt(query)).toBe(1);

		query.state = {
			data: { status: "completed" },
			dataUpdatedAt: TEN_MINUTES - 1_000,
		};
		vi.setSystemTime(TEN_MINUTES);
		expect(refetchInterval(query)).toBe(30_000);
	});

	it("keeps polling fast while a run is in progress regardless of age", () => {
		vi.useFakeTimers();
		vi.setSystemTime(TEN_MINUTES * 3);
		const refetchInterval = adaptiveRefetchInterval(classifyWorkflowRun);
		expect(
			refetchInterval({
				state: { data: { status: "in_progress" }, dataUpdatedAt: 1 },
			}),
		).toBe(5_000);
	});
});

describe("cache policy vs poll intervals", () => {
	it("keeps every adaptively polled tier's staleTime at or below its interval", () => {
		expect(githubCachePolicy.status.staleTimeMs).toBeLessThanOrEqual(
			githubPollIntervalMs.active,
		);
		expect(githubCachePolicy.workflowRun.staleTimeMs).toBeLessThanOrEqual(
			githubPollIntervalMs.active,
		);
	});
});
