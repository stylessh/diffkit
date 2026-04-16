import {
	CodeIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	IssuesIcon,
	UserCircleIcon,
} from "@diffkit/icons";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";
import { githubQueryKeys } from "#/lib/github.query";
import type {
	CommandPaletteSearchResult,
	IssueSummary,
	MyIssuesResult,
	MyPullsResult,
	PullSummary,
	UserRepoSummary,
} from "#/lib/github.types";
import { getRegisteredCommands, subscribeCommands } from "./registry";
import type { CommandItem } from "./types";

function getPrIcon(pr: PullSummary) {
	if (pr.isDraft) {
		return {
			icon: GitPullRequestDraftIcon,
			iconClassName: "text-muted-foreground",
		};
	}
	if (pr.mergedAt) {
		return { icon: GitMergeIcon, iconClassName: "text-purple-500" };
	}
	if (pr.state === "closed") {
		return { icon: GitPullRequestClosedIcon, iconClassName: "text-red-500" };
	}
	return { icon: GitPullRequestIcon, iconClassName: "text-green-500" };
}

function getIssueIcon(issue: IssueSummary) {
	if (issue.state === "closed") {
		if (issue.stateReason === "not_planned") {
			return { icon: IssuesIcon, iconClassName: "text-muted-foreground" };
		}
		return { icon: IssuesIcon, iconClassName: "text-purple-500" };
	}
	return { icon: IssuesIcon, iconClassName: "text-green-500" };
}

const routeApi = getRouteApi("/_protected");

export function useCommandItems(): CommandItem[] {
	const { user } = routeApi.useRouteContext();
	const scope = { userId: user.id };
	const queryClient = useQueryClient();

	const staticCommands = useSyncExternalStore(
		subscribeCommands,
		getRegisteredCommands,
		getRegisteredCommands,
	);

	const repos = queryClient.getQueryData<UserRepoSummary[]>(
		githubQueryKeys.repos.list(scope),
	);
	const pulls = queryClient.getQueryData<MyPullsResult>(
		githubQueryKeys.pulls.mine(scope),
	);
	const issues = queryClient.getQueryData<MyIssuesResult>(
		githubQueryKeys.issues.mine(scope),
	);
	const viewer = queryClient.getQueryData<{ login: string } | null>(
		githubQueryKeys.viewer(scope),
	);

	const dynamicItems: CommandItem[] = [];

	if (viewer) {
		dynamicItems.push({
			id: "nav:profile",
			label: "Go to Profile",
			group: "Pages",
			icon: UserCircleIcon,
			keywords: ["user", "me", viewer.login],
			shortcut: ["G", "U"],
			action: {
				type: "navigate",
				to: `/${viewer.login}`,
			},
		});
	}

	if (repos) {
		for (const repo of repos) {
			dynamicItems.push({
				id: `repo:${repo.id}`,
				label: repo.fullName,
				group: "Repositories",
				icon: CodeIcon,
				keywords: [repo.name, repo.owner, repo.language ?? ""].filter(Boolean),
				action: {
					type: "navigate",
					to: `/${repo.owner}/${repo.name}`,
				},
				meta: {
					language: repo.language,
					stars: repo.stars,
					updatedAt: repo.updatedAt ?? undefined,
				},
			});
		}
	}

	if (pulls) {
		const seen = new Set<number>();
		const allPulls = [
			...pulls.authored,
			...pulls.assigned,
			...pulls.reviewRequested,
			...pulls.mentioned,
			...pulls.involved,
		];
		for (const pr of allPulls) {
			if (seen.has(pr.id)) continue;
			seen.add(pr.id);
			const prState = getPrIcon(pr);
			dynamicItems.push({
				id: `pull:${pr.id}`,
				label: `#${pr.number} ${pr.title}`,
				group: "Pull Requests",
				icon: prState.icon,
				iconClassName: prState.iconClassName,
				keywords: [
					pr.repository.name,
					pr.repository.owner,
					pr.author?.login ?? "",
					String(pr.number),
				].filter(Boolean),
				action: {
					type: "navigate",
					to: `/${pr.repository.owner}/${pr.repository.name}/pull/${pr.number}`,
				},
				meta: {
					repo: pr.repository.fullName,
					comments: pr.comments,
					updatedAt: pr.updatedAt,
				},
			});
		}
	}

	if (issues) {
		const seen = new Set<number>();
		const allIssues = [
			...issues.authored,
			...issues.assigned,
			...issues.mentioned,
		];
		for (const issue of allIssues) {
			if (seen.has(issue.id)) continue;
			seen.add(issue.id);
			const issueState = getIssueIcon(issue);
			dynamicItems.push({
				id: `issue:${issue.id}`,
				label: `#${issue.number} ${issue.title}`,
				group: "Issues",
				icon: issueState.icon,
				iconClassName: issueState.iconClassName,
				keywords: [
					issue.repository.name,
					issue.repository.owner,
					issue.author?.login ?? "",
					String(issue.number),
				].filter(Boolean),
				action: {
					type: "navigate",
					to: `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`,
				},
				meta: {
					repo: issue.repository.fullName,
					comments: issue.comments,
					updatedAt: issue.updatedAt,
				},
			});
		}
	}

	dynamicItems.sort((a, b) => {
		const aTime = a.meta?.updatedAt ?? "";
		const bTime = b.meta?.updatedAt ?? "";
		return bTime.localeCompare(aTime);
	});

	return [...staticCommands, ...dynamicItems];
}

export function getCommandSearchItems(
	result: CommandPaletteSearchResult | undefined,
): CommandItem[] {
	if (!result) {
		return [];
	}

	const items: CommandItem[] = [];

	for (const pr of result.pulls) {
		const prState = getPrIcon(pr);
		items.push({
			id: `pull:${pr.id}`,
			label: `#${pr.number} ${pr.title}`,
			group: "Pull Requests",
			icon: prState.icon,
			iconClassName: prState.iconClassName,
			keywords: [
				pr.repository.name,
				pr.repository.owner,
				pr.author?.login ?? "",
				String(pr.number),
			].filter(Boolean),
			action: {
				type: "navigate",
				to: `/${pr.repository.owner}/${pr.repository.name}/pull/${pr.number}`,
			},
			meta: {
				repo: pr.repository.fullName,
				comments: pr.comments,
				updatedAt: pr.updatedAt,
			},
		});
	}

	for (const issue of result.issues) {
		const issueState = getIssueIcon(issue);
		items.push({
			id: `issue:${issue.id}`,
			label: `#${issue.number} ${issue.title}`,
			group: "Issues",
			icon: issueState.icon,
			iconClassName: issueState.iconClassName,
			keywords: [
				issue.repository.name,
				issue.repository.owner,
				issue.author?.login ?? "",
				String(issue.number),
			].filter(Boolean),
			action: {
				type: "navigate",
				to: `/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`,
			},
			meta: {
				repo: issue.repository.fullName,
				comments: issue.comments,
				updatedAt: issue.updatedAt,
			},
		});
	}

	return items;
}

export function cacheSearchResults(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	result: CommandPaletteSearchResult,
) {
	if (result.pulls.length > 0) {
		queryClient.setQueryData<MyPullsResult>(
			githubQueryKeys.pulls.mine(scope),
			(prev) => {
				if (!prev) return prev;
				const existingIds = new Set(prev.involved.map((p) => p.id));
				const newPulls = result.pulls.filter((p) => !existingIds.has(p.id));
				if (newPulls.length === 0) return prev;
				return {
					...prev,
					involved: [...prev.involved, ...newPulls],
				};
			},
		);
	}

	if (result.issues.length > 0) {
		queryClient.setQueryData<MyIssuesResult>(
			githubQueryKeys.issues.mine(scope),
			(prev) => {
				if (!prev) return prev;
				const existingIds = new Set(prev.mentioned.map((i) => i.id));
				const newIssues = result.issues.filter((i) => !existingIds.has(i.id));
				if (newIssues.length === 0) return prev;
				return {
					...prev,
					mentioned: [...prev.mentioned, ...newIssues],
				};
			},
		);
	}
}
