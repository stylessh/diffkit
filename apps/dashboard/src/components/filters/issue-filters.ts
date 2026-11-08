import { CircleIcon, IssuesIcon } from "@diffkit/icons";
import { createElement } from "react";
import { authorFilterDef, repoFilterDef } from "./filter-helpers";
import type {
	FilterableItem,
	FilterDefinition,
	FilterOption,
	SortOption,
} from "./use-list-filters";

type IssueFilterableItem = FilterableItem & {
	stateReason: string | null;
};

function asIssue(item: FilterableItem): IssueFilterableItem {
	return item as IssueFilterableItem;
}

type IssueStatus = "open" | "completed" | "not_planned";

function issueStatus(item: IssueFilterableItem): IssueStatus {
	if (item.state !== "closed") return "open";
	return item.stateReason === "not_planned" ? "not_planned" : "completed";
}

const ISSUE_STATUS_META: {
	value: IssueStatus;
	label: string;
	colorClass: string;
}[] = [
	{ value: "open", label: "Open", colorClass: "text-success" },
	{
		value: "completed",
		label: "Closed (completed)",
		colorClass: "text-merged",
	},
	{
		value: "not_planned",
		label: "Closed (not planned)",
		colorClass: "text-muted-foreground",
	},
];

function toStatusOption(
	meta: (typeof ISSUE_STATUS_META)[number],
): FilterOption {
	return {
		value: meta.value,
		label: meta.label,
		icon: createElement(IssuesIcon, {
			size: 14,
			className: meta.colorClass,
		}),
	};
}

const issueStatusFilterDef: FilterDefinition = {
	id: "status",
	label: "Status",
	icon: CircleIcon,
	extractOptions: (items) => {
		const present = new Set<IssueStatus>();
		for (const item of items) present.add(issueStatus(asIssue(item)));
		return ISSUE_STATUS_META.filter((m) => present.has(m.value)).map(
			toStatusOption,
		);
	},
	match: (item, values) => values.has(issueStatus(asIssue(item))),
};

const repoIssueStatusFilterDef: FilterDefinition = {
	...issueStatusFilterDef,
	extractOptions: () => ISSUE_STATUS_META.map(toStatusOption),
};

export const issueFilterDefs: FilterDefinition[] = [
	repoFilterDef,
	authorFilterDef,
	issueStatusFilterDef,
];

/** Filter defs for repo-scoped issue lists — static options, no repository filter. */
export const repoIssueFilterDefs: FilterDefinition[] = [
	repoIssueStatusFilterDef,
	authorFilterDef,
];

export const issueSortOptions: SortOption[] = [
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
	{
		id: "comments",
		label: "Most comments",
		compare: (a, b) => b.comments - a.comments,
	},
	{
		id: "title",
		label: "Title A–Z",
		compare: (a, b) => a.title.localeCompare(b.title),
	},
];
