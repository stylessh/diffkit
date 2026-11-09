import { createServerFn } from "@tanstack/react-start";
import type { RepoMilestone } from "../github.types";
import { fetchPaginatedGitHubResource } from "./client";
import { getGitHubContextForRepository } from "./installations";
import type { GitHubClient } from "./shared";
import { identityValidator } from "./validators";

export type RepoMilestonesInput = {
	owner: string;
	repo: string;
};

export const getRepoMilestones = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoMilestonesInput>)
	.handler(async ({ data }): Promise<RepoMilestone[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];

		return fetchPaginatedGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["issues"]["listMilestones"]>
			>["data"][number],
			RepoMilestone[]
		>({
			context,
			resource: "repos.milestones",
			params: data,
			request: (page) =>
				context.octokit.rest.issues.listMilestones({
					owner: data.owner,
					repo: data.repo,
					state: "open",
					page,
					per_page: 100,
				}),
			mapData: (milestones) =>
				milestones.map((milestone) => ({
					number: milestone.number,
					title: milestone.title,
					dueOn: milestone.due_on,
					openIssues: milestone.open_issues,
					closedIssues: milestone.closed_issues,
				})),
		}).catch(() => []);
	});
