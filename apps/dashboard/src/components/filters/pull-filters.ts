import {
	CircleIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
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

type PullFilterableItem = FilterableItem & {
	isDraft: boolean;
	mergedAt: string | null;
};

function asPull(item: FilterableItem): PullFilterableItem {
	return item as PullFilterableItem;
}

type PullStatus = "open" | "draft" | "merged" | "closed";

function pullStatus(item: PullFilterableItem): PullStatus {
	if (item.mergedAt) return "merged";
	if (item.state === "closed") return "closed";
	if (item.isDraft) return "draft";
	return "open";
}

const PULL_STATUS_META: {
	value: PullStatus;
	label: string;
	icon: React.ComponentType<{ size?: number; className?: string }>;
	colorClass: string;
}[] = [
	{
		value: "open",
		label: "Open",
		icon: GitPullRequestIcon,
		colorClass: "text-success",
	},
	{
		value: "draft",
		label: "Draft",
		icon: GitPullRequestDraftIcon,
		colorClass: "text-muted-foreground",
	},
	{
		value: "merged",
		label: "Merged",
		icon: GitMergeIcon,
		colorClass: "text-merged",
	},
	{
		value: "closed",
		label: "Closed",
		icon: GitPullRequestClosedIcon,
		colorClass: "text-danger",
	},
];

function toStatusOption(meta: (typeof PULL_STATUS_META)[number]): FilterOption {
	return {
		value: meta.value,
		label: meta.label,
		icon: createElement(meta.icon, {
			size: 14,
			className: meta.colorClass,
		}),
	};
}

const pullStatusFilterDef: FilterDefinition = {
	id: "status",
	label: "Status",
	icon: CircleIcon,
	extractOptions: (items) => {
		const present = new Set<PullStatus>();
		for (const item of items) present.add(pullStatus(asPull(item)));
		return PULL_STATUS_META.filter((m) => present.has(m.value)).map(
			toStatusOption,
		);
	},
	match: (item, values) => values.has(pullStatus(asPull(item))),
};

const repoPullStatusFilterDef: FilterDefinition = {
	...pullStatusFilterDef,
	extractOptions: () => PULL_STATUS_META.map(toStatusOption),
	negatable: false,
};

export const pullFilterDefs: FilterDefinition[] = [
	pullStatusFilterDef,
	authorFilterDef,
	labelFilterDef,
	repoFilterDef,
	updatedFilterDef,
];

export const repoPullFilterDefs: FilterDefinition[] = [
	repoPullStatusFilterDef,
	authorFilterDef,
	labelFilterDef,
	updatedFilterDef,
];

export const pullSortOptions: SortOption[] = itemSortOptions;
