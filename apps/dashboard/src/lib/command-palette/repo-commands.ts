import {
	GitBranchIcon,
	GitCommitIcon,
	PackageIcon,
	PlusSignIcon,
} from "@diffkit/icons";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import type { CommandItem } from "./types";

/** "Go to …" commands for the repository the user is currently viewing. */
export function getRepoSectionCommands(
	owner: string,
	repo: string,
): CommandItem[] {
	const base = `/${owner}/${repo}`;
	const fullName = `${owner}/${repo}`;
	const keywords = [owner, repo, fullName];
	return [
		{
			id: `repo-nav:${fullName}:commits`,
			label: "Go to Commits",
			group: fullName,
			icon: GitCommitIcon,
			keywords: [...keywords, "history", "log"],
			action: { type: "navigate", to: `${base}/commits` },
		},
		{
			id: `repo-nav:${fullName}:branches`,
			label: "Go to Branches",
			group: fullName,
			icon: GitBranchIcon,
			keywords: [...keywords, "refs", "stale"],
			action: { type: "navigate", to: `${base}/branches` },
		},
		{
			id: `repo-nav:${fullName}:tags`,
			label: "Go to Tags",
			group: fullName,
			icon: TagIcon,
			keywords: [...keywords, "refs", "versions"],
			action: { type: "navigate", to: `${base}/tags` },
		},
		{
			id: `repo-nav:${fullName}:releases`,
			label: "Go to Releases",
			group: fullName,
			icon: PackageIcon,
			keywords: [...keywords, "changelog", "versions"],
			action: { type: "navigate", to: `${base}/releases` },
		},
		{
			id: `repo-nav:${fullName}:new-release`,
			label: "Draft a New Release",
			group: fullName,
			icon: PlusSignIcon,
			keywords: [...keywords, "publish", "tag", "release"],
			action: { type: "navigate", to: `${base}/releases/new` },
		},
	];
}
