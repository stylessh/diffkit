import type { WorkflowRunJob } from "#/lib/github.types";
import {
	H_BORDER,
	H_JOB_HEADER,
	H_MATRIX_CARD_GAP,
	H_MATRIX_OUTER_PAD,
	H_MATRIX_PILL,
	H_MATRIX_STATS,
	H_NO_STEPS,
	H_STEP_FIRST_LAST_EXTRA,
	H_STEP_ROW,
	STEP_LOG_HEIGHT,
} from "./constants";
import type { FlowNode } from "./types";

export function estimateJobCardHeight(
	job: WorkflowRunJob,
	expanded: boolean,
): number {
	if (!expanded) return H_JOB_HEADER;
	if (job.steps.length === 0) return H_JOB_HEADER + H_BORDER + H_NO_STEPS;
	return (
		H_JOB_HEADER +
		H_BORDER +
		job.steps.length * H_STEP_ROW +
		H_STEP_FIRST_LAST_EXTRA
	);
}

export function estimateMatrixHeight(
	jobs: WorkflowRunJob[],
	expanded: boolean,
): number {
	const main = H_JOB_HEADER + (expanded ? H_BORDER + H_MATRIX_STATS : 0);
	if (!expanded) return H_MATRIX_OUTER_PAD + main;
	return (
		H_MATRIX_OUTER_PAD +
		main +
		jobs.length * H_MATRIX_PILL +
		Math.max(0, jobs.length - 1) * H_MATRIX_CARD_GAP
	);
}

export function estimateNodeHeight(node: FlowNode): number {
	if (node.type === "stepLog") return STEP_LOG_HEIGHT;
	if (node.type === "matrix")
		return estimateMatrixHeight(node.data.jobs, !node.data.collapsed);
	return estimateJobCardHeight(node.data.job, !node.data.collapsed);
}
