import {
	CircleIcon,
	FolderLibraryIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	UserCircleIcon,
} from "@diffkit/icons";
import { createElement } from "react";
import type {
	FilterableItem,
	FilterDefinition,
	SortOption,
} from "./use-list-filters";

type PullFilterableItem = FilterableItem & {
	isDraft: boolean;
	mergedAt: string | null;
};

function asPull(item: FilterableItem): PullFilterableItem {
	return item as PullFilterableItem;
}

export const pullFilterDefs: FilterDefinition[] = [
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
				const pull = asPull(item);
				if (pull.mergedAt) statuses.add("merged");
				else if (pull.state === "closed") statuses.add("closed");
				else if (pull.isDraft) statuses.add("draft");
				else statuses.add("open");
			}
			const all: {
				value: string;
				label: string;
				icon: React.ComponentType<{ size?: number; className?: string }>;
			}[] = [
				{ value: "open", label: "Open", icon: GitPullRequestIcon },
				{ value: "draft", label: "Draft", icon: GitPullRequestDraftIcon },
				{ value: "merged", label: "Merged", icon: GitMergeIcon },
				{ value: "closed", label: "Closed", icon: GitPullRequestClosedIcon },
			];
			const colorMap: Record<string, string> = {
				open: "text-green-500",
				draft: "text-muted-foreground",
				merged: "text-purple-500",
				closed: "text-red-500",
			};
			return all
				.filter((s) => statuses.has(s.value))
				.map((s) => ({
					value: s.value,
					label: s.label,
					icon: createElement(s.icon, {
						size: 14,
						className: colorMap[s.value],
					}),
				}));
		},
		match: (item, values) => {
			const pull = asPull(item);
			if (pull.mergedAt) return values.has("merged");
			if (pull.state === "closed") return values.has("closed");
			if (pull.isDraft) return values.has("draft");
			return values.has("open");
		},
	},
];

/** Filter defs for repo-scoped pull lists — static options, no repository filter. */
export const repoPullFilterDefs: FilterDefinition[] = [
	{
		id: "status",
		label: "Status",
		icon: CircleIcon,
		extractOptions: () => {
			const colorMap: Record<string, string> = {
				open: "text-green-500",
				draft: "text-muted-foreground",
				merged: "text-purple-500",
				closed: "text-red-500",
			};
			return (
				[
					{ value: "open", label: "Open", icon: GitPullRequestIcon },
					{ value: "draft", label: "Draft", icon: GitPullRequestDraftIcon },
					{ value: "merged", label: "Merged", icon: GitMergeIcon },
					{ value: "closed", label: "Closed", icon: GitPullRequestClosedIcon },
				] as const
			).map((s) => ({
				value: s.value,
				label: s.label,
				icon: createElement(s.icon, {
					size: 14,
					className: colorMap[s.value],
				}),
			}));
		},
		match: (item, values) => {
			const pull = asPull(item);
			if (pull.mergedAt) return values.has("merged");
			if (pull.state === "closed") return values.has("closed");
			if (pull.isDraft) return values.has("draft");
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
