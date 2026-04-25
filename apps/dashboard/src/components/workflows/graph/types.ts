import type { Node } from "@xyflow/react";
import type { CheckState } from "#/components/checks/check-state-icon";
import type { WorkflowRunJob } from "#/lib/github.types";

export type JobGroup =
	| { kind: "single"; job: WorkflowRunJob }
	| { kind: "matrix"; baseName: string; jobs: WorkflowRunJob[] };

export type JobNodeData = {
	job: WorkflowRunJob;
	collapsed?: boolean;
	toggleable?: boolean;
};

export type MatrixNodeData = {
	baseName: string;
	jobs: WorkflowRunJob[];
	aggregate: CheckState;
	collapsed?: boolean;
	toggleable?: boolean;
};

export type StepLogNodeData = {
	jobId: number;
	jobStatus: string;
	stepNumber: number;
	stepName: string;
	stepStatus: string;
	stepConclusion: string | null;
	stepStartedAt: string | null;
	stepCompletedAt: string | null;
};

export type FlowNode =
	| Node<JobNodeData, "job">
	| Node<MatrixNodeData, "matrix">
	| Node<StepLogNodeData, "stepLog">;

export type GraphEdge = {
	id: string;
	source: string;
	target: string;
	type: string;
};
