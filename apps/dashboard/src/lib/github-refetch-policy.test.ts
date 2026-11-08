import { afterEach, describe, expect, it, vi } from "vitest";
import { githubCachePolicy } from "./github-cache-policy";
import {
	adaptiveRefetchInterval,
	classifyPullStatus,
	classifyWorkflowJobs,
	classifyWorkflowRun,
	GITHUB_SETTLED_POLL_STOP_AFTER_MS,
	type GitHubPollPhase,
	getAdaptiveRefetchInterval,
	getQueryDataLastChangedAt,
	githubPollIntervalMs,
} from "./github-refetch-policy";

const TEN_MINUTES = GITHUB_SETTLED_POLL_STOP_AFTER_MS;

describe("getAdaptiveRefetchInterval", () => {
	const at = (phase: GitHubPollPhase, lastChangedAt: number, now: number) =>
		getAdaptiveRefetchInterval({ phase, lastChangedAt, now });

	it("polls running work fast, however old", () => {
		expect(at("running", 0, TEN_MINUTES * 5)).toBe(
			githubPollIntervalMs.running,
		);
	});

	it("keeps waiting at the idle rate, however old", () => {
		expect(at("waiting", 0, TEN_MINUTES * 5)).toBe(githubPollIntervalMs.idle);
	});

	it("stops a settled entity once it has been unchanged for ten minutes", () => {
		expect(at("settled", 1_000, 1_000 + TEN_MINUTES - 1)).toBe(
			githubPollIntervalMs.idle,
		);
		expect(at("settled", 1_000, 1_000 + TEN_MINUTES)).toBe(false);
	});
});

describe("classifiers", () => {
	it("classifies workflow runs by status", () => {
		expect(classifyWorkflowRun({ status: "in_progress" })).toBe("running");
		expect(classifyWorkflowRun({ status: "queued" })).toBe("running");
		expect(classifyWorkflowRun({ status: "completed" })).toBe("settled");
		expect(classifyWorkflowRun(null)).toBe("waiting");
	});

	it("classifies job lists as running until every job completes", () => {
		expect(
			classifyWorkflowJobs([{ status: "completed" }, { status: "queued" }]),
		).toBe("running");
		expect(
			classifyWorkflowJobs([{ status: "completed" }, { status: "completed" }]),
		).toBe("settled");
		expect(classifyWorkflowJobs([])).toBe("waiting");
	});

	it("settles a PR status once no checks are pending, open or not", () => {
		const status = (pending: number) => ({
			checks: {
				total: 3,
				passed: 3 - pending,
				failed: 0,
				pending,
				skipped: 0,
				expected: 0,
			},
		});
		expect(classifyPullStatus(status(1))).toBe("running");
		expect(classifyPullStatus(status(0))).toBe("settled");
		expect(classifyPullStatus(null)).toBe("waiting");
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
});

describe("cache policy vs poll intervals", () => {
	it("keeps every adaptively polled tier's staleTime at or below its interval", () => {
		expect(githubCachePolicy.status.staleTimeMs).toBeLessThanOrEqual(
			githubPollIntervalMs.running,
		);
		expect(githubCachePolicy.workflowRun.staleTimeMs).toBeLessThanOrEqual(
			githubPollIntervalMs.running,
		);
	});
});
