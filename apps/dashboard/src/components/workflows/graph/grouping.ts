import {
	type CheckState,
	getCheckState,
} from "#/components/checks/check-state-icon";
import type { WorkflowRunJob } from "#/lib/github.types";
import { MATRIX_SUFFIX_RE } from "./constants";
import type { JobGroup } from "./types";

export function getGroupId(group: JobGroup): string {
	if (group.kind === "matrix") return `matrix-${group.baseName}`;
	return `job-${group.job.id}`;
}

export function groupJobs(jobs: WorkflowRunJob[]): JobGroup[] {
	const bucket = new Map<string, WorkflowRunJob[]>();
	const order: string[] = [];

	for (const job of jobs) {
		const match = MATRIX_SUFFIX_RE.exec(job.name);
		const key = match ? match[1] : job.name;
		if (!bucket.has(key)) {
			bucket.set(key, []);
			order.push(key);
		}
		bucket.get(key)?.push(job);
	}

	return order.map((key) => {
		const group = bucket.get(key) ?? [];
		if (group.length > 1) {
			return { kind: "matrix", baseName: key, jobs: group };
		}
		const job = group[0];
		if (!job) return { kind: "matrix", baseName: key, jobs: [] };
		return { kind: "single", job };
	});
}

export function buildColumns(groups: JobGroup[]): JobGroup[][] {
	const columns: JobGroup[][] = [];
	let runningSingles: JobGroup[] = [];
	for (const group of groups) {
		if (group.kind === "matrix") {
			if (runningSingles.length > 0) {
				columns.push(runningSingles);
				runningSingles = [];
			}
			columns.push([group]);
		} else {
			runningSingles.push(group);
		}
	}
	if (runningSingles.length > 0) columns.push(runningSingles);
	return columns;
}

export function getAggregateState(jobs: WorkflowRunJob[]): CheckState {
	const states = jobs.map((j) => getCheckState(j));
	if (states.some((s) => s === "failure")) return "failure";
	if (states.some((s) => s === "pending" || s === "expected")) return "pending";
	if (states.some((s) => s === "waiting")) return "waiting";
	if (states.length > 0 && states.every((s) => s === "skipped")) {
		return "skipped";
	}
	return "success";
}

export function buildNameMatcher(
	template: string | null,
	key: string,
	isMatrix: boolean,
): (name: string) => boolean {
	if (template) {
		const PLACEHOLDER = "\x00";
		const withPlaceholder = template.replace(/\$\{\{[^}]*\}\}/g, PLACEHOLDER);
		const escaped = withPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = `^${escaped.split(PLACEHOLDER).join(".+?")}$`;
		const re = new RegExp(pattern);
		return (name) => re.test(name);
	}
	if (isMatrix) {
		return (name) => name === key || name.startsWith(`${key} (`);
	}
	return (name) => name === key;
}
