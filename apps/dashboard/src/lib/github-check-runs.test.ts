import { describe, expect, it } from "vitest";
import { deduplicateCheckRuns, isFailedCheckRun } from "./github.functions";

describe("deduplicateCheckRuns", () => {
	it("returns an empty array when given no check runs", () => {
		expect(deduplicateCheckRuns([])).toEqual([]);
	});

	it("returns a single run unchanged", () => {
		const runs = [
			{ id: 1, name: "build", status: "completed", conclusion: "success" },
		];
		expect(deduplicateCheckRuns(runs)).toEqual(runs);
	});

	it("keeps the run with the highest id when names collide", () => {
		const runs = [
			{ id: 10, name: "test", status: "completed", conclusion: "failure" },
			{ id: 20, name: "test", status: "completed", conclusion: "success" },
			{ id: 5, name: "test", status: "completed", conclusion: "failure" },
		];
		const result = deduplicateCheckRuns(runs);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(20);
	});

	it("preserves runs with different names", () => {
		const runs = [
			{ id: 1, name: "lint", status: "completed", conclusion: "success" },
			{ id: 2, name: "build", status: "completed", conclusion: "failure" },
			{ id: 3, name: "test", status: "queued", conclusion: null },
		];
		expect(deduplicateCheckRuns(runs)).toEqual(runs);
	});

	it("deduplicates only by name, not by conclusion", () => {
		const runs = [
			{ id: 100, name: "deploy", status: "completed", conclusion: "failure" },
			{ id: 200, name: "deploy", status: "completed", conclusion: "success" },
			{ id: 300, name: "deploy", status: "in_progress", conclusion: null },
		];
		const result = deduplicateCheckRuns(runs);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(300);
	});
});

describe("isFailedCheckRun", () => {
	it("returns true for conclusion=failure", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "completed",
				conclusion: "failure",
			}),
		).toBe(true);
	});

	it("returns true for conclusion=timed_out", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "completed",
				conclusion: "timed_out",
			}),
		).toBe(true);
	});

	it("returns true for conclusion=cancelled", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "completed",
				conclusion: "cancelled",
			}),
		).toBe(true);
	});

	it("returns true for conclusion=action_required", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "completed",
				conclusion: "action_required",
			}),
		).toBe(true);
	});

	it("returns false for conclusion=success", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "completed",
				conclusion: "success",
			}),
		).toBe(false);
	});

	it("returns false for conclusion=neutral", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "completed",
				conclusion: "neutral",
			}),
		).toBe(false);
	});

	it("returns false for conclusion=skipped", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "completed",
				conclusion: "skipped",
			}),
		).toBe(false);
	});

	it("returns false for null conclusion (still running)", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "completed",
				conclusion: null,
			}),
		).toBe(false);
	});

	it("returns false for in-progress runs", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "in_progress",
				conclusion: null,
			}),
		).toBe(false);
	});

	it("returns false for queued runs", () => {
		expect(
			isFailedCheckRun({
				id: 1,
				name: "ci",
				status: "queued",
				conclusion: null,
			}),
		).toBe(false);
	});
});
