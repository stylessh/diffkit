import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import type {
	CommitReference,
	IssueReferenceStatus,
	ItemReference,
	PullReferenceStatus,
} from "../github.types";
import { markdownExcerpt } from "../markdown-excerpt";
import { fetchGitHubResource } from "./client";
import { getGitHubContextForRepository } from "./installations";
import { mapActor, mapLabels } from "./mappers";
import { identityValidator } from "./validators";

type ItemReferenceInput = { owner: string; repo: string; number: number };
type CommitReferenceInput = { owner: string; repo: string; sha: string };

type RawIssue = {
	number: number;
	title: string;
	state: string;
	state_reason?: string | null;
	draft?: boolean;
	body?: string | null;
	comments: number;
	created_at: string;
	user?: Parameters<typeof mapActor>[0];
	labels?: Parameters<typeof mapLabels>[0];
	pull_request?: { merged_at?: string | null } | null;
};

function pullStatus(issue: RawIssue): PullReferenceStatus {
	if (issue.pull_request?.merged_at) return "merged";
	if (issue.state === "closed") return "closed";
	return issue.draft ? "draft" : "open";
}

function issueStatus(issue: RawIssue): IssueReferenceStatus {
	if (issue.state !== "closed") return "open";
	return issue.state_reason === "not_planned" ? "notPlanned" : "completed";
}

function mapItemReference(
	input: ItemReferenceInput,
	issue: RawIssue,
): ItemReference {
	const base = {
		owner: input.owner,
		repo: input.repo,
		number: issue.number,
		title: issue.title,
		author: mapActor(issue.user),
		createdAt: issue.created_at,
		comments: issue.comments,
		labels: mapLabels(issue.labels),
		excerpt: markdownExcerpt(issue.body),
	};
	return issue.pull_request
		? { ...base, kind: "pull", status: pullStatus(issue) }
		: { ...base, kind: "issue", status: issueStatus(issue) };
}

async function nullWhenInaccessible<T>(read: () => Promise<T>) {
	try {
		return await read();
	} catch (error) {
		if (
			error instanceof RequestError &&
			(error.status === 404 || error.status === 403)
		) {
			return null;
		}
		throw error;
	}
}

/**
 * One issues-API read serves both kinds: GitHub returns pull requests from
 * the issues endpoint with a `pull_request` field.
 */
export const getItemReference = createServerFn({ method: "GET" })
	.validator(identityValidator<ItemReferenceInput>)
	.handler(async ({ data }): Promise<ItemReference | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;
		return nullWhenInaccessible(() =>
			fetchGitHubResource({
				context,
				resource: "references.item",
				params: data,
				request: (signal) =>
					context.octokit.rest.issues.get({
						owner: data.owner,
						repo: data.repo,
						issue_number: data.number,
						request: { signal },
					}),
				mapData: (issue) => mapItemReference(data, issue as RawIssue),
			}),
		);
	});

export const getCommitReference = createServerFn({ method: "GET" })
	.validator(identityValidator<CommitReferenceInput>)
	.handler(async ({ data }): Promise<CommitReference | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;
		return nullWhenInaccessible(() =>
			fetchGitHubResource({
				context,
				resource: "references.commit",
				params: data,
				request: (signal) =>
					context.octokit.rest.repos.getCommit({
						owner: data.owner,
						repo: data.repo,
						ref: data.sha,
						// Stats come with the commit; one file is the smallest page GitHub allows.
						per_page: 1,
						request: { signal },
					}),
				mapData: (commit): CommitReference => ({
					owner: data.owner,
					repo: data.repo,
					sha: commit.sha,
					title: (commit.commit.message ?? "").split("\n", 1)[0],
					author: mapActor(commit.author),
					authorName: commit.commit.author?.name ?? null,
					date:
						commit.commit.author?.date ?? commit.commit.committer?.date ?? "",
					verified: commit.commit.verification?.verified ?? false,
					stats: commit.stats
						? {
								additions: commit.stats.additions ?? 0,
								deletions: commit.stats.deletions ?? 0,
							}
						: null,
				}),
			}),
		);
	});
