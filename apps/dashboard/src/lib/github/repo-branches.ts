import { createServerFn } from "@tanstack/react-start";
import type {
	BranchComparison,
	PullCommit,
	PullFile,
	RepoBranch,
} from "../github.types";
import { isRecentPush } from "../recent-push";
import { fetchGitHubResource, getViewer } from "./client";
import {
	getGitHubContextForRepository,
	getGitHubUserContextForRepository,
} from "./installations";
import { mapActor } from "./mappers";
import { dedupeGitHubRead } from "./request-dedup";
import type { GitHubClient, GitHubContext } from "./shared";
import { identityValidator } from "./validators";

type RepoBranchesInput = {
	owner: string;
	repo: string;
};

export const getRepoBranches = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoBranchesInput>)
	.handler(async ({ data }): Promise<RepoBranch[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];

		return fetchGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["repos"]["listBranches"]>
			>["data"],
			RepoBranch[]
		>({
			context,
			resource: "repo.branches.v1",
			params: data,
			request: () =>
				context.octokit.rest.repos.listBranches({
					owner: data.owner,
					repo: data.repo,
					per_page: 25,
				}),
			mapData: (branches) =>
				branches.map((b) => ({
					name: b.name,
					isProtected: b.protected,
				})),
		});
	});

type BranchComparisonInput = {
	owner: string;
	repo: string;
	base: string;
	head: string;
};

export const getBranchComparison = createServerFn({ method: "GET" })
	.validator(identityValidator<BranchComparisonInput>)
	.handler(async ({ data }): Promise<BranchComparison | null> => {
		if (data.base === data.head) return null;
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		return fetchGitHubResource<
			Awaited<
				ReturnType<GitHubClient["rest"]["repos"]["compareCommitsWithBasehead"]>
			>["data"],
			BranchComparison
		>({
			context,
			resource: "repo.branchComparison.v1",
			params: data,
			request: () =>
				context.octokit.rest.repos.compareCommitsWithBasehead({
					owner: data.owner,
					repo: data.repo,
					basehead: `${data.base}...${data.head}`,
					per_page: 1,
				}),
			mapData: (comparison) => ({
				aheadBy: comparison.ahead_by,
				behindBy: comparison.behind_by,
				status: comparison.status as BranchComparison["status"],
				totalCommits: comparison.total_commits,
			}),
		}).catch(() => null);
	});

export type RecentPushableBranch = {
	branch: string;
	pushedAt: string;
	aheadBy: number;
};

type RecentPushableBranchInput = {
	owner: string;
	repo: string;
};

async function listViewerPushes(
	userContext: GitHubContext,
	repository: RecentPushableBranchInput,
) {
	const viewer = await getViewer(userContext);
	if (!viewer.login) {
		return null;
	}

	const activities = await userContext.octokit.rest.repos.listActivities({
		owner: repository.owner,
		repo: repository.repo,
		actor: viewer.login,
		activity_type: "push",
		time_period: "day",
		per_page: 10,
	});
	return activities.data;
}

export const getRecentPushableBranch = createServerFn({ method: "GET" })
	.validator(identityValidator<RecentPushableBranchInput>)
	.handler(async ({ data }): Promise<RecentPushableBranch | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		const userContext = await getGitHubUserContextForRepository(data);
		if (!userContext) return null;

		try {
			return await dedupeGitHubRead<RecentPushableBranch | null>({
				userId: context.session.user.id,
				resource: "repo.recentPushableBranch.v1",
				params: data,
				fetcher: async () => {
					const [overview, pushes] = await Promise.all([
						context.octokit.rest.repos.get({
							owner: data.owner,
							repo: data.repo,
						}),
						listViewerPushes(userContext, data),
					]);
					const defaultBranch = overview.data.default_branch;
					if (!defaultBranch || !pushes) {
						return null;
					}

					const seen = new Set<string>();
					for (const activity of pushes) {
						const ref = activity.ref;
						if (!ref.startsWith("refs/heads/")) continue;
						const branch = ref.slice("refs/heads/".length);
						if (branch === defaultBranch) continue;
						if (!isRecentPush(activity.timestamp)) continue;
						if (seen.has(branch)) continue;
						seen.add(branch);

						const existingPrs = await context.octokit.rest.pulls.list({
							owner: data.owner,
							repo: data.repo,
							head: `${data.owner}:${branch}`,
							state: "open",
							per_page: 1,
						});
						if (existingPrs.data.length > 0) continue;

						const comparison =
							await context.octokit.rest.repos.compareCommitsWithBasehead({
								owner: data.owner,
								repo: data.repo,
								basehead: `${defaultBranch}...${branch}`,
								per_page: 1,
							});
						if (comparison.data.ahead_by === 0) continue;

						return {
							branch,
							pushedAt: activity.timestamp,
							aheadBy: comparison.data.ahead_by,
						};
					}

					return null;
				},
			});
		} catch {
			return null;
		}
	});

export type CompareDetail = {
	aheadBy: number;
	behindBy: number;
	status: "ahead" | "behind" | "diverged" | "identical";
	totalCommits: number;
	/** The commit the head is diffed against; moves when the base advances. */
	mergeBaseSha: string;
	commits: PullCommit[];
	files: PullFile[];
	/** True when the file list hit GitHub's 300-file cap for this endpoint. */
	filesTruncated: boolean;
};

const COMPARE_COMMITS_MAX_PAGES = 3;
const COMPARE_COMMITS_PER_PAGE = 100;
const COMPARE_FILES_CAP = 300;

export const getCompareDetail = createServerFn({ method: "GET" })
	.validator(identityValidator<BranchComparisonInput>)
	.handler(async ({ data }): Promise<CompareDetail | null> => {
		if (data.base === data.head) return null;
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;

		try {
			return await dedupeGitHubRead<CompareDetail>({
				userId: context.session.user.id,
				resource: "repo.compareDetail.v3",
				params: data,
				fetcher: async () => {
					const first =
						await context.octokit.rest.repos.compareCommitsWithBasehead({
							owner: data.owner,
							repo: data.repo,
							basehead: `${data.base}...${data.head}`,
							per_page: COMPARE_COMMITS_PER_PAGE,
							page: 1,
						});

					const commitsRaw: (typeof first.data.commits)[number][] = [
						...first.data.commits,
					];
					const totalCommits = first.data.total_commits;

					// Paginate additional commit pages — compareCommitsWithBasehead
					// returns files only on page 1, so we only collect commits here.
					for (let page = 2; page <= COMPARE_COMMITS_MAX_PAGES; page++) {
						if (commitsRaw.length >= totalCommits) break;
						const next =
							await context.octokit.rest.repos.compareCommitsWithBasehead({
								owner: data.owner,
								repo: data.repo,
								basehead: `${data.base}...${data.head}`,
								per_page: COMPARE_COMMITS_PER_PAGE,
								page,
							});
						if (next.data.commits.length === 0) break;
						commitsRaw.push(...next.data.commits);
					}

					const files = first.data.files ?? [];
					const filesTruncated = files.length >= COMPARE_FILES_CAP;
					if (filesTruncated) {
						console.warn(
							`[compare detail] file list truncated at ${COMPARE_FILES_CAP} for ${data.owner}/${data.repo} ${data.base}...${data.head}`,
						);
					}

					return {
						aheadBy: first.data.ahead_by,
						behindBy: first.data.behind_by,
						status: first.data.status as CompareDetail["status"],
						totalCommits,
						mergeBaseSha: first.data.merge_base_commit.sha,
						commits: commitsRaw.map((c) => ({
							sha: c.sha,
							message: c.commit.message,
							createdAt:
								c.commit.committer?.date ?? c.commit.author?.date ?? "",
							author: mapActor(c.author),
						})),
						files: files.map((f) => ({
							sha: f.sha ?? null,
							filename: f.filename,
							status: f.status as PullFile["status"],
							additions: f.additions,
							deletions: f.deletions,
							changes: f.changes,
							patch: f.patch ?? null,
							previousFilename: f.previous_filename ?? null,
						})),
						filesTruncated,
					};
				},
			});
		} catch {
			return null;
		}
	});
