import type {
	GitHubActor,
	PullComment,
	PullCommit,
	PullDetail,
	RepositoryRef,
} from "../github.types";
import { fetchGitHubResource } from "./client";
import {
	buildRepositoryRef,
	mapActor,
	mapPullSummary,
	restEditedAt,
} from "./mappers";
import type { GitHubClient, GitHubContext, PullFromRepoInput } from "./shared";

export type RepoPullDetail = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["get"]>
>["data"];

export function mapPullDetail(
	pull: RepoPullDetail,
	repository: RepositoryRef,
): PullDetail {
	return {
		...mapPullSummary(pull, repository),
		graphqlId:
			"node_id" in pull && typeof pull.node_id === "string"
				? pull.node_id
				: undefined,
		body: pull.body ?? "",
		additions: pull.additions,
		deletions: pull.deletions,
		changedFiles: pull.changed_files,
		commits: pull.commits,
		reviewComments: pull.review_comments,
		headRefName: pull.head.ref,
		headSha: pull.head.sha,
		headRepoOwner: pull.head.repo?.owner?.login ?? null,
		baseRefName: pull.base.ref,
		isMerged: pull.merged,
		mergeCommitSha: pull.merge_commit_sha ?? null,
		mergedBy: pull.merged_by ? mapActor(pull.merged_by) : null,
		mergeable: pull.mergeable,
		mergeableState:
			typeof pull.mergeable_state === "string" ? pull.mergeable_state : null,
		requestedReviewers: (pull.requested_reviewers ?? [])
			.map((reviewer) => mapActor(reviewer))
			.filter((reviewer): reviewer is GitHubActor => Boolean(reviewer)),
		requestedTeams: (pull.requested_teams ?? []).map((team) => ({
			slug: team.slug,
			name: team.name,
			url: team.html_url,
		})),
	};
}

export async function getRawPull(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<RepoPullDetail> {
	return fetchGitHubResource<RepoPullDetail, RepoPullDetail>({
		context,
		resource: "pulls.detail.raw",
		params: data,
		request: () =>
			context.octokit.rest.pulls.get({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
			}),
		mapData: (pull) => pull,
	});
}

export async function getPullDetailResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullDetail> {
	const pull = await getRawPull(context, data);
	return mapPullDetail(pull, buildRepositoryRef(data.owner, data.repo));
}

export async function getPullCommentsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullComment[]> {
	type IssueComment = Awaited<
		ReturnType<GitHubClient["rest"]["issues"]["listComments"]>
	>["data"][number];

	return fetchGitHubResource<IssueComment[], PullComment[]>({
		context,
		resource: "pulls.comments",
		params: data,
		request: () =>
			context.octokit.rest.issues.listComments({
				owner: data.owner,
				repo: data.repo,
				issue_number: data.pullNumber,
				per_page: 10,
			}),
		mapData: (comments) =>
			comments.map((comment) => {
				const nodeId =
					"node_id" in comment &&
					typeof (comment as { node_id?: unknown }).node_id === "string"
						? (comment as { node_id: string }).node_id
						: undefined;
				return {
					id: comment.id,
					...(nodeId ? { graphqlId: nodeId } : {}),
					body: comment.body ?? "",
					createdAt: comment.created_at,
					editedAt: restEditedAt(comment),
					author: mapActor(comment.user),
				};
			}),
	});
}

export async function getPullCommitsResult(
	context: GitHubContext,
	data: PullFromRepoInput,
): Promise<PullCommit[]> {
	type PullCommitResponse = Awaited<
		ReturnType<GitHubClient["rest"]["pulls"]["listCommits"]>
	>["data"][number];

	return fetchGitHubResource<PullCommitResponse[], PullCommit[]>({
		context,
		resource: "pulls.commits",
		params: data,
		request: () =>
			context.octokit.rest.pulls.listCommits({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				per_page: 100,
			}),
		mapData: (commits) =>
			commits.map((c) => ({
				sha: c.sha,
				message: c.commit.message,
				createdAt: c.commit.author?.date ?? c.commit.committer?.date ?? "",
				author: mapActor(c.author),
			})),
	});
}
