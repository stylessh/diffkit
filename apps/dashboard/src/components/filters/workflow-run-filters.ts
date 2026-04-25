import {
	CalendarIcon,
	CheckIcon,
	CircleIcon,
	ClockIcon,
	GitBranchIcon,
	LoaderCircleIcon,
	MinusSignIcon,
	XIcon,
} from "@diffkit/icons";
import { createElement } from "react";
import { authorFilterDef } from "./filter-helpers";
import type {
	FilterableItem,
	FilterDefinition,
	FilterOption,
	SortOption,
} from "./use-list-filters";

type WorkflowRunFilterable = FilterableItem & {
	status: string;
	conclusion: string | null;
	event: string;
	headBranch: string | null;
};

function asRun(item: FilterableItem): WorkflowRunFilterable {
	return item as WorkflowRunFilterable;
}

export type RunStatusValue =
	| "queued"
	| "in_progress"
	| "success"
	| "failure"
	| "cancelled"
	| "skipped";

export function runStatus(item: {
	status: string;
	conclusion: string | null;
}): RunStatusValue {
	if (item.status === "queued" || item.status === "waiting") return "queued";
	if (item.status !== "completed") return "in_progress";
	if (item.conclusion === "success" || item.conclusion === "neutral") {
		return "success";
	}
	if (item.conclusion === "skipped" || item.conclusion === "stale") {
		return "skipped";
	}
	if (item.conclusion === "cancelled") return "cancelled";
	return "failure";
}

const RUN_STATUS_META: readonly {
	value: RunStatusValue;
	label: string;
	icon: React.ComponentType<{ size?: number; className?: string }>;
	colorClass: string;
}[] = [
	{
		value: "in_progress",
		label: "In progress",
		icon: LoaderCircleIcon,
		colorClass: "text-yellow-500",
	},
	{
		value: "queued",
		label: "Queued",
		icon: ClockIcon,
		colorClass: "text-muted-foreground",
	},
	{
		value: "success",
		label: "Success",
		icon: CheckIcon,
		colorClass: "text-green-500",
	},
	{
		value: "failure",
		label: "Failure",
		icon: XIcon,
		colorClass: "text-red-500",
	},
	{
		value: "cancelled",
		label: "Cancelled",
		icon: MinusSignIcon,
		colorClass: "text-muted-foreground",
	},
	{
		value: "skipped",
		label: "Skipped",
		icon: CircleIcon,
		colorClass: "text-muted-foreground",
	},
];

function toStatusOption(meta: (typeof RUN_STATUS_META)[number]): FilterOption {
	return {
		value: meta.value,
		label: meta.label,
		icon: createElement(meta.icon, { size: 14, className: meta.colorClass }),
	};
}

const RUN_STATUS_OPTIONS: readonly FilterOption[] =
	RUN_STATUS_META.map(toStatusOption);

const runStatusFilterDef: FilterDefinition = {
	id: "status",
	label: "Status",
	icon: CircleIcon,
	extractOptions: () => RUN_STATUS_OPTIONS as FilterOption[],
	match: (item, values) => values.has(runStatus(asRun(item))),
};

/** Common GitHub Actions event triggers (static — API does not list them). */
const EVENT_LABELS: Readonly<Record<string, string>> = {
	push: "Push",
	pull_request: "Pull request",
	workflow_dispatch: "Manual",
	schedule: "Schedule",
	release: "Release",
	workflow_run: "Workflow run",
	repository_dispatch: "Repository dispatch",
	pull_request_target: "Pull request (target)",
	check_run: "Check run",
	check_suite: "Check suite",
	issues: "Issues",
	issue_comment: "Issue comment",
	deployment: "Deployment",
	merge_group: "Merge group",
};

function labelForEvent(event: string): string {
	return EVENT_LABELS[event] ?? event;
}

const runEventFilterDef: FilterDefinition = {
	id: "event",
	label: "Event",
	icon: CalendarIcon,
	extractOptions: (items) => {
		const present = new Set<string>();
		for (const item of items) present.add(asRun(item).event);
		return [...present].sort().map((event) => ({
			value: event,
			label: labelForEvent(event),
		}));
	},
	match: (item, values) => values.has(asRun(item).event),
};

/** Build a branch FilterDefinition from a list of branch names (data-driven). */
export function makeBranchFilterDef(
	branchNames: readonly string[],
): FilterDefinition {
	const options: FilterOption[] = branchNames.map((name) => ({
		value: name,
		label: name,
	}));
	return {
		id: "branch",
		label: "Branch",
		icon: GitBranchIcon,
		extractOptions: (items) => {
			if (options.length > 0) return options;
			const present = new Set<string>();
			for (const item of items) {
				const branch = asRun(item).headBranch;
				if (branch) present.add(branch);
			}
			return [...present].sort().map((name) => ({ value: name, label: name }));
		},
		match: (item, values) => {
			const b = asRun(item).headBranch;
			return b ? values.has(b) : false;
		},
	};
}

export const repoWorkflowRunFilterDefs: FilterDefinition[] = [
	runStatusFilterDef,
	runEventFilterDef,
	authorFilterDef,
];

export const workflowRunSortOptions: SortOption[] = [
	{
		id: "updated",
		label: "Recently updated",
		compare: (a, b) =>
			new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
	},
	{
		id: "created",
		label: "Newest first",
		compare: (a, b) =>
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	},
	{
		id: "created-asc",
		label: "Oldest first",
		compare: (a, b) =>
			new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	},
];

/** Map a `status` filter pill value to the GitHub API `status` query parameter. */
export function deriveApiStatus(
	values: Set<string>,
):
	| "queued"
	| "in_progress"
	| "success"
	| "failure"
	| "cancelled"
	| "skipped"
	| undefined {
	if (values.size !== 1) return undefined;
	const [first] = values;
	return first as RunStatusValue;
}
