import {
	CodeIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	IssuesIcon,
	RefreshCwIcon,
} from "@diffkit/icons";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useParams } from "@tanstack/react-router";
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
import { getRepoSectionCommands } from "./repo-commands";
import { useShellCommandItems } from "./shell-commands";
import type { CommandItem } from "./types";
import { useRefreshGitHubData } from "./use-refresh-github-data";

function getPrIcon(pr: PullSummary) {
	if (pr.isDraft) {
		return {
			icon: GitPullRequestDraftIcon,
			iconClassName: "text-muted-foreground",
		};
	}
	if (pr.mergedAt) {
		return { icon: GitMergeIcon, iconClassName: "text-merged" };
	}
	if (pr.state === "closed") {
		return { icon: GitPullRequestClosedIcon, iconClassName: "text-danger" };
	}
	return { icon: GitPullRequestIcon, iconClassName: "text-success" };
}

function getIssueIcon(issue: IssueSummary) {
	if (issue.state === "closed") {
		if (issue.stateReason === "not_planned") {
			return { icon: IssuesIcon, iconClassName: "text-muted-foreground" };
		}
		return { icon: IssuesIcon, iconClassName: "text-merged" };
	}
	return { icon: IssuesIcon, iconClassName: "text-success" };
}

const routeApi = getRouteApi("/_protected");

export function useCommandItems(): CommandItem[] {
	const { user } = routeApi.useRouteContext();
	const scope = { userId: user.id };
	const queryClient = useQueryClient();
	const refreshGitHubData = useRefreshGitHubData();
	const shellItems = useShellCommandItems(user.id);

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
	const routeParams = useParams({ strict: false }) as {
		owner?: string;
		repo?: string;
	};
	const repoItems =
		routeParams.owner && routeParams.repo
			? getRepoSectionCommands(routeParams.owner, routeParams.repo)
			: [];

	const dynamicItems: CommandItem[] = [
		{
			id: "action:refresh-data",
			label: "Refresh data",
			group: "Actions",
			icon: RefreshCwIcon,
			keywords: ["refresh", "reload", "clear cache", "stale", "sync"],
			action: {
				type: "execute",
				fn: () => {
					void refreshGitHubData();
				},
			},
		},
	];

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
				preview: { kind: "repo", repo },
			});
		}
	}

	if (pulls) {
		const seen = new Set<string>();
		const allPulls = [
			...pulls.authored,
			...pulls.assigned,
			...pulls.reviewRequested,
			...pulls.mentioned,
			...pulls.involved,
		];
		for (const pr of allPulls) {
			if (seen.has(itemKey(pr))) continue;
			seen.add(itemKey(pr));
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
				preview: { kind: "pull", pull: pr },
			});
		}
	}

	if (issues) {
		const seen = new Set<string>();
		const allIssues = [
			...issues.authored,
			...issues.assigned,
			...issues.mentioned,
		];
		for (const issue of allIssues) {
			if (seen.has(itemKey(issue))) continue;
			seen.add(itemKey(issue));
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
				preview: { kind: "issue", issue },
			});
		}
	}

	dynamicItems.sort((a, b) => {
		const aTime = a.meta?.updatedAt ?? "";
		const bTime = b.meta?.updatedAt ?? "";
		return bTime.localeCompare(aTime);
	});

	// Pages are reached from the topbar and their G-shortcuts; the palette is for everything else.
	const commands = staticCommands.filter(
		(command) => command.group !== "Pages",
	);
	return [...commands, ...shellItems, ...repoItems, ...dynamicItems];
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
			preview: { kind: "pull", pull: pr },
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
			preview: { kind: "issue", issue },
		});
	}

	return items;
}

/** GitHub's search and the list queries give one item different ids; its repository and number are the same. */
function itemKey(item: { repository: { fullName: string }; number: number }) {
	return `${item.repository.fullName}#${item.number}`;
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
				const known = new Set(
					[
						...prev.authored,
						...prev.assigned,
						...prev.reviewRequested,
						...prev.mentioned,
						...prev.involved,
					].map(itemKey),
				);
				const newPulls = result.pulls.filter((p) => !known.has(itemKey(p)));
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
				const known = new Set(
					[...prev.authored, ...prev.assigned, ...prev.mentioned].map(itemKey),
				);
				const newIssues = result.issues.filter((i) => !known.has(itemKey(i)));
				if (newIssues.length === 0) return prev;
				return {
					...prev,
					mentioned: [...prev.mentioned, ...newIssues],
				};
			},
		);
	}
}
