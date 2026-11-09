import type {
	WorkflowRun,
	WorkflowRunJob,
	WorkflowRunStep,
} from "#/lib/github.types";

const sampleStep = (
	number: number,
	name: string,
	startedAt: string,
	completedAt: string,
): WorkflowRunStep => ({
	number,
	name,
	status: "completed",
	conclusion: "success",
	startedAt,
	completedAt,
});

const sampleJob = (id: number, name: string): WorkflowRunJob => ({
	id,
	runId: 0,
	name,
	status: "completed",
	conclusion: "success",
	startedAt: "2026-01-01T12:00:00Z",
	completedAt: "2026-01-01T12:02:14Z",
	htmlUrl: null,
	labels: ["ubuntu-latest"],
	runnerName: null,
	steps: [
		sampleStep(1, "Set up job", "2026-01-01T12:00:00Z", "2026-01-01T12:00:03Z"),
		sampleStep(
			2,
			"Checkout repository",
			"2026-01-01T12:00:03Z",
			"2026-01-01T12:00:06Z",
		),
		sampleStep(
			3,
			"Install dependencies",
			"2026-01-01T12:00:06Z",
			"2026-01-01T12:01:10Z",
		),
		sampleStep(4, "Run checks", "2026-01-01T12:01:10Z", "2026-01-01T12:02:12Z"),
		sampleStep(
			5,
			"Complete job",
			"2026-01-01T12:02:12Z",
			"2026-01-01T12:02:14Z",
		),
	],
});

export const SAMPLE_WORKFLOW_RUN: WorkflowRun = {
	id: 0,
	name: "CI",
	displayTitle: "Update dependency versions across the workspace",
	status: "completed",
	conclusion: "success",
	event: "pull_request",
	headBranch: "chore/update-dependencies",
	headSha: "0000000",
	runNumber: 1287,
	runAttempt: 1,
	runStartedAt: "2026-01-01T12:00:00Z",
	createdAt: "2026-01-01T12:00:00Z",
	updatedAt: "2026-01-01T12:02:14Z",
	htmlUrl: "",
	path: ".github/workflows/ci.yml",
	workflowId: 0,
	actor: null,
	triggeringActor: { login: "octocat", avatarUrl: "", url: "", type: "User" },
	pullRequests: [],
	viewerCanRerun: true,
};

export const SAMPLE_WORKFLOW_JOB = sampleJob(2, "Unit tests");

export const SAMPLE_WORKFLOW_JOBS: WorkflowRunJob[] = [
	sampleJob(1, "Lint and typecheck"),
	SAMPLE_WORKFLOW_JOB,
	sampleJob(3, "Build"),
];
