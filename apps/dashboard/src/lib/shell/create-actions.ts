import { GitPullRequestIcon, IssuesIcon, PackageIcon } from "@diffkit/icons";
import type { ComponentType } from "react";
import type { RepoRef } from "./workspace-repos";

export type CreateActionId = "new-issue" | "new-pull" | "new-release";

export type CreateAction = {
	id: CreateActionId;
	label: string;
	icon: ComponentType<{
		size?: number;
		strokeWidth?: number;
		className?: string;
	}>;
	keys: [string, string];
	keywords: string[];
};

export const CREATE_ACTIONS: readonly CreateAction[] = [
	{
		id: "new-issue",
		label: "New issue",
		icon: IssuesIcon,
		keys: ["N", "I"],
		keywords: ["create", "issue", "bug", "report"],
	},
	{
		id: "new-pull",
		label: "New pull request",
		icon: GitPullRequestIcon,
		keys: ["N", "P"],
		keywords: ["create", "pull request", "pr", "compare", "branch"],
	},
	{
		id: "new-release",
		label: "New release",
		icon: PackageIcon,
		keys: ["N", "R"],
		keywords: ["create", "release", "tag", "publish", "draft"],
	},
];

export type NewPullEntry = "compare" | "branches";

/**
 * The new-PR entry is the branch compare page. Builds without a
 * `/$owner/$repo/compare` index route send it to the branches page instead,
 * whose rows each link to a compare: the `compare/$` splat route redirects an
 * empty range back to the repository.
 */
export function createActionPath(
	id: CreateActionId,
	repo: RepoRef,
	newPullEntry: NewPullEntry,
) {
	const base = `/${repo.owner}/${repo.name}`;
	switch (id) {
		case "new-issue":
			return `${base}/issues/new`;
		case "new-pull":
			return `${base}/${newPullEntry}`;
		case "new-release":
			return `${base}/releases/new`;
	}
}

export type CreateTarget =
	| { kind: "navigate"; to: string }
	| { kind: "pick-repo"; action: CreateActionId };

export function resolveCreateTarget(
	id: CreateActionId,
	currentRepo: RepoRef | null,
	newPullEntry: NewPullEntry,
): CreateTarget {
	return currentRepo
		? { kind: "navigate", to: createActionPath(id, currentRepo, newPullEntry) }
		: { kind: "pick-repo", action: id };
}
