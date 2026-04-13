import {
	CircleIcon,
	FolderLibraryIcon,
	IssuesIcon,
	UserCircleIcon,
} from "@diffkit/icons";
import { createElement } from "react";
import type {
	FilterableItem,
	FilterDefinition,
	SortOption,
} from "./use-list-filters";

type IssueFilterableItem = FilterableItem & {
	stateReason: string | null;
};

function asIssue(item: FilterableItem): IssueFilterableItem {
	return item as IssueFilterableItem;
}

export const issueFilterDefs: FilterDefinition[] = [
	{
		id: "repo",
		label: "Repository",
		icon: FolderLibraryIcon,
		extractOptions: (items) => {
			const repos = new Map<string, string>();
			for (const item of items) {
				const name = item.repository.fullName;
				if (!repos.has(name)) repos.set(name, name);
			}
			return [...repos.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([value, label]) => ({ value, label }));
		},
		match: (item, values) => values.has(item.repository.fullName),
	},
	{
		id: "author",
		label: "Author",
		icon: UserCircleIcon,
		extractOptions: (items) => {
			const authors = new Map<string, { login: string; avatarUrl: string }>();
			for (const item of items) {
				if (item.author && !authors.has(item.author.login)) {
					authors.set(item.author.login, item.author);
				}
			}
			return [...authors.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([login, author]) => ({
					value: login,
					label: login,
					icon: createElement("img", {
						src: author.avatarUrl,
						alt: login,
						className: "size-4 rounded-full",
					}),
				}));
		},
		match: (item, values) =>
			item.author ? values.has(item.author.login) : false,
	},
	{
		id: "status",
		label: "Status",
		icon: CircleIcon,
		extractOptions: (items) => {
			const statuses = new Set<string>();
			for (const item of items) {
				const issue = asIssue(item);
				if (issue.state === "closed") {
					statuses.add(
						issue.stateReason === "not_planned" ? "not_planned" : "completed",
					);
				} else {
					statuses.add("open");
				}
			}
			const all = [
				{ value: "open", label: "Open" },
				{ value: "completed", label: "Closed (completed)" },
				{ value: "not_planned", label: "Closed (not planned)" },
			];
			const colorMap: Record<string, string> = {
				open: "text-green-500",
				completed: "text-purple-500",
				not_planned: "text-muted-foreground",
			};
			return all
				.filter((s) => statuses.has(s.value))
				.map((s) => ({
					value: s.value,
					label: s.label,
					icon: createElement(IssuesIcon, {
						size: 14,
						className: colorMap[s.value],
					}),
				}));
		},
		match: (item, values) => {
			const issue = asIssue(item);
			if (issue.state === "closed") {
				return issue.stateReason === "not_planned"
					? values.has("not_planned")
					: values.has("completed");
			}
			return values.has("open");
		},
	},
];

/** Filter defs for repo-scoped issue lists — static options, no repository filter. */
export const repoIssueFilterDefs: FilterDefinition[] = [
	{
		id: "status",
		label: "Status",
		icon: CircleIcon,
		extractOptions: () => {
			const colorMap: Record<string, string> = {
				open: "text-green-500",
				completed: "text-purple-500",
				not_planned: "text-muted-foreground",
			};
			return [
				{ value: "open", label: "Open" },
				{ value: "completed", label: "Closed (completed)" },
				{ value: "not_planned", label: "Closed (not planned)" },
			].map((s) => ({
				value: s.value,
				label: s.label,
				icon: createElement(IssuesIcon, {
					size: 14,
					className: colorMap[s.value],
				}),
			}));
		},
		match: (item, values) => {
			const issue = asIssue(item);
			if (issue.state === "closed") {
				return issue.stateReason === "not_planned"
					? values.has("not_planned")
					: values.has("completed");
			}
			return values.has("open");
		},
	},
	{
		id: "author",
		label: "Author",
		icon: UserCircleIcon,
		extractOptions: (items) => {
			const authors = new Map<string, { login: string; avatarUrl: string }>();
			for (const item of items) {
				if (item.author && !authors.has(item.author.login)) {
					authors.set(item.author.login, item.author);
				}
			}
			return [...authors.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([login, author]) => ({
					value: login,
					label: login,
					icon: createElement("img", {
						src: author.avatarUrl,
						alt: login,
						className: "size-4 rounded-full",
					}),
				}));
		},
		match: (item, values) =>
			item.author ? values.has(item.author.login) : false,
	},
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
