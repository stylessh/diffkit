import { describe, expect, it, vi } from "vitest";
import {
	type CheckRunItem,
	type CombinedStatusItem,
	summarizePullChecks,
	type WorkflowRunItem,
} from "./pull-checks";

vi.mock("cloudflare:workers", () => ({ env: {} }));

const checkRun = (fields: Partial<CheckRunItem>) =>
	({
		id: 1,
		name: "build",
		status: "completed",
		conclusion: "success",
		check_suite: null,
		...fields,
	}) as CheckRunItem;

const commitStatus = (fields: Partial<CombinedStatusItem>) =>
	({
		id: 1,
		context: "ci/external",
		state: "success",
		...fields,
	}) as CombinedStatusItem;

const workflowRun = (fields: Partial<WorkflowRunItem>) =>
	({
		id: 500,
		name: "CI",
		event: "pull_request",
		status: "completed",
		conclusion: "success",
		check_suite_id: null,
		...fields,
	}) as WorkflowRunItem;

describe("summarizePullChecks", () => {
	it("merges check runs, commit statuses and required contexts into one list", () => {
		const summary = summarizePullChecks({
			checkRuns: [
				checkRun({ id: 1, name: "build", conclusion: "failure" }),
				checkRun({ id: 2, name: "build", check_suite: { id: 70 } }),
				checkRun({
					id: 3,
					name: "lint",
					status: "in_progress",
					conclusion: null,
				}),
				checkRun({ id: 4, name: "docs", conclusion: "skipped" }),
			],
			statuses: [
				commitStatus({ id: 10, context: "ci/external", state: "pending" }),
				commitStatus({ id: 11, context: "ci/external", state: "failure" }),
				commitStatus({ id: 12, context: "build", state: "failure" }),
			],
			workflowRuns: [
				workflowRun({ id: 500, check_suite_id: 70 }),
				workflowRun({
					id: 501,
					name: "Deploy",
					status: "waiting",
					conclusion: null,
				}),
				workflowRun({ id: 502, name: null, conclusion: "action_required" }),
			],
			requiredContexts: ["build", "e2e"],
		});

		expect(
			summary.checkRuns.map((check) => [
				check.name,
				check.status,
				check.conclusion,
				check.required,
			]),
		).toEqual([
			["build", "completed", "success", true],
			["lint", "in_progress", null, false],
			["docs", "completed", "skipped", false],
			["ci/external", "completed", "failure", false],
			["e2e", "expected", null, true],
		]);
		expect(summary.checkRuns[0].workflowRunId).toBe(500);
		expect(summary.checks).toEqual({
			total: 5,
			passed: 1,
			failed: 1,
			pending: 1,
			skipped: 1,
			expected: 1,
		});
		expect(summary.pendingWorkflowApprovals).toEqual([
			{ workflowRunId: 501, name: "Deploy", event: "pull_request" },
			{ workflowRunId: 502, name: "Workflow #502", event: "pull_request" },
		]);
	});
});
