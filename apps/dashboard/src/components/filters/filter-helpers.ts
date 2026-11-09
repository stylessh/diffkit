import {
	ClockIcon,
	FolderLibraryIcon,
	LabelIcon,
	UserCircleIcon,
} from "@diffkit/icons";
import { createElement } from "react";
import type {
	FilterableItem,
	FilterDefinition,
	FilterOption,
	SortOption,
} from "./filter-model";

function sortedOptions<T>(
	entries: Map<string, T>,
	toOption: (key: string, value: T) => FilterOption,
) {
	return [...entries.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => toOption(key, value));
}

export const repoFilterDef: FilterDefinition = {
	id: "repo",
	label: "Repository",
	icon: FolderLibraryIcon,
	extractOptions: (items) => {
		const repos = new Map<string, string>();
		for (const item of items) {
			repos.set(item.repository.fullName, item.repository.fullName);
		}
		return sortedOptions(repos, (value) => ({ value, label: value }));
	},
	match: (item, values) => values.has(item.repository.fullName),
};

export const authorFilterDef: FilterDefinition = {
	id: "author",
	label: "Author",
	icon: UserCircleIcon,
	extractOptions: (items) => {
		const authors = new Map<string, string>();
		for (const item of items) {
			if (item.author) authors.set(item.author.login, item.author.avatarUrl);
		}
		return sortedOptions(authors, (login, avatarUrl) => ({
			value: login,
			label: login,
			icon: createElement("img", {
				src: avatarUrl,
				alt: "",
				className: "size-4 rounded-full",
			}),
		}));
	},
	match: (item, values) =>
		item.author ? values.has(item.author.login) : false,
};

type LabelledItem = FilterableItem & {
	labels?: { name: string; color: string }[];
};

export const labelFilterDef: FilterDefinition = {
	id: "label",
	label: "Label",
	icon: LabelIcon,
	extractOptions: (items) => {
		const labels = new Map<string, string>();
		for (const item of items as LabelledItem[]) {
			for (const label of item.labels ?? []) {
				labels.set(label.name, label.color);
			}
		}
		return sortedOptions(labels, (name, color) => ({
			value: name,
			label: name,
			icon: createElement(
				"span",
				{
					"aria-hidden": true,
					className: "flex size-2 shrink-0 items-center justify-center",
				},
				createElement("span", {
					className: "size-1.5 rounded-full",
					style: { backgroundColor: `#${color}` },
				}),
			),
		}));
	},
	match: (item, values) =>
		((item as LabelledItem).labels ?? []).some((label) =>
			values.has(label.name),
		),
};

const DAY_MS = 24 * 60 * 60 * 1000;

const UPDATED_RANGES = [
	{ value: "1d", label: "Past day", days: 1 },
	{ value: "7d", label: "Past week", days: 7 },
	{ value: "30d", label: "Past month", days: 30 },
	{ value: "90d", label: "Past 3 months", days: 90 },
] as const;

export const updatedFilterDef: FilterDefinition = {
	id: "updated",
	label: "Updated",
	icon: ClockIcon,
	extractOptions: () =>
		UPDATED_RANGES.map(({ value, label }) => ({ value, label })),
	match: (item, values) => {
		const age = Date.now() - Date.parse(item.updatedAt);
		return UPDATED_RANGES.some(
			(range) => values.has(range.value) && age <= range.days * DAY_MS,
		);
	},
};

function byDate(field: "updatedAt" | "createdAt", direction: 1 | -1) {
	return (a: FilterableItem, b: FilterableItem) =>
		direction * (Date.parse(b[field]) - Date.parse(a[field]));
}

export const itemSortOptions: SortOption[] = [
	{ id: "updated", label: "Recently updated", compare: byDate("updatedAt", 1) },
	{ id: "created", label: "Newest first", compare: byDate("createdAt", 1) },
	{
		id: "created-asc",
		label: "Oldest first",
		compare: byDate("createdAt", -1),
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
