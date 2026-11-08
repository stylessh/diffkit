import {
	CircleIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import { createElement } from "react";
import { authorFilterDef, repoFilterDef } from "./filter-helpers";
import type {
	FilterableItem,
	FilterDefinition,
	FilterOption,
	SortOption,
} from "./use-list-filters";

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
};

export const pullFilterDefs: FilterDefinition[] = [
	repoFilterDef,
	authorFilterDef,
	pullStatusFilterDef,
];

/** Filter defs for repo-scoped pull lists — static options, no repository filter. */
export const repoPullFilterDefs: FilterDefinition[] = [
	repoPullStatusFilterDef,
	authorFilterDef,
];

export const pullSortOptions: SortOption[] = [
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
