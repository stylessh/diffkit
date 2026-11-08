import { CircleIcon, IssuesIcon } from "@diffkit/icons";
import { createElement } from "react";
import {
	authorFilterDef,
	itemSortOptions,
	labelFilterDef,
	repoFilterDef,
	updatedFilterDef,
} from "./filter-helpers";
import type {
	FilterableItem,
	FilterDefinition,
	FilterOption,
	SortOption,
} from "./filter-model";

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
	negatable: false,
};

export const issueFilterDefs: FilterDefinition[] = [
	issueStatusFilterDef,
	authorFilterDef,
	labelFilterDef,
	repoFilterDef,
	updatedFilterDef,
];

export const repoIssueFilterDefs: FilterDefinition[] = [
	repoIssueStatusFilterDef,
	authorFilterDef,
	labelFilterDef,
	updatedFilterDef,
];

export const issueSortOptions: SortOption[] = itemSortOptions;
