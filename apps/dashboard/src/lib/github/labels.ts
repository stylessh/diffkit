import { createServerFn } from "@tanstack/react-start";
import type {
	CreateLabelInput,
	GitHubLabel,
	SetLabelsInput,
} from "../github.types";
import { bumpGitHubCacheNamespaces } from "../github-cache";
import { githubCachePolicy } from "../github-cache-policy";
import { githubRevalidationSignalKeys } from "../github-revalidation";
import { getCachedPaginatedGitHubRequest } from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import {
	bustIssueCaches,
	bustPullDetailCaches,
	type GitHubClient,
} from "./shared";
import { identityValidator } from "./validators";

export type RepoLabelsInput = {
	owner: string;
	repo: string;
};

export const getRepoLabels = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<RepoLabelsInput>)
	.handler(async ({ data }): Promise<GitHubLabel[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) {
			return [];
		}

		return getCachedPaginatedGitHubRequest<
			Awaited<
				ReturnType<GitHubClient["rest"]["issues"]["listLabelsForRepo"]>
			>["data"][number],
			GitHubLabel[]
		>({
			context,
			resource: "repos.labels",
			params: data,
			freshForMs: githubCachePolicy.viewer.staleTimeMs,
			namespaceKeys: [
				githubRevalidationSignalKeys.repoLabels({
					owner: data.owner,
					repo: data.repo,
				}),
			],
			cacheMode: "split",
			request: (page) =>
				context.octokit.rest.issues.listLabelsForRepo({
					owner: data.owner,
					repo: data.repo,
					page,
					per_page: 100,
				}),
			mapData: (allLabels) =>
				allLabels.map((l) => ({
					name: l.name,
					color: l.color ?? "000000",
					description: l.description ?? null,
				})),
		}).catch(() => []);
	});

export const setIssueLabels = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<SetLabelsInput>)
	.handler(async ({ data }): Promise<boolean> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return false;
		}

		try {
			await context.octokit.rest.issues.setLabels({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.issueNumber,
				labels: data.labels,
			});
			const userId = context.session.user.id;
			await Promise.all([
				bustPullDetailCaches(userId, {
					owner: data.owner,
					repo: data.repo,
					pullNumber: data.issueNumber,
				}),
				bustIssueCaches(userId, {
					owner: data.owner,
					repo: data.repo,
					issueNumber: data.issueNumber,
				}),
			]);
			return true;
		} catch {
			return false;
		}
	});

export const createRepoLabel = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<CreateLabelInput>)
	.handler(async ({ data }): Promise<GitHubLabel | null> => {
		const context = await getGitHubUserContextForRepository(data);
		if (!context) {
			return null;
		}

		try {
			const response = await context.octokit.rest.issues.createLabel({
				owner: data.owner,
				repo: data.repo,
				name: data.name,
				color: data.color,
			});
			await bumpGitHubCacheNamespaces([
				githubRevalidationSignalKeys.repoLabels({
					owner: data.owner,
					repo: data.repo,
				}),
			]);
			return {
				name: response.data.name,
				color: response.data.color ?? "000000",
				description: response.data.description ?? null,
			};
		} catch {
			return null;
		}
	});
