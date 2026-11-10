import type {
	PullFile,
	PullFileSummariesPage,
	PullFileSummariesPageInput,
	PullFileSummary,
	PullFilesPage,
	PullFilesPageInput,
} from "../github.types";
import {
	fetchGitHubResource,
	GitHubOperationTimeoutError,
	getRemainingSearchTimeoutMs,
	withGitHubOperationTimeout,
} from "./client";
import { dedupeGitHubRead } from "./request-dedup";
import {
	clampPage,
	clampPerPage,
	GITHUB_MIN_OPERATION_TIMEOUT_MS,
	GITHUB_OPERATION_TIMEOUT_MS,
	GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
	type GitHubClient,
	type GitHubContext,
} from "./shared";

type RepoPullFile = Awaited<
	ReturnType<GitHubClient["rest"]["pulls"]["listFiles"]>
>["data"][number];

export async function getPullFilesResult(
	context: GitHubContext,
	data: PullFilesPageInput,
): Promise<PullFilesPage> {
	const page = clampPage(data.page);
	const perPage = clampPerPage(data.perPage, 20);

	return fetchGitHubResource<RepoPullFile[], PullFilesPage>({
		context,
		resource: "pulls.filesPage",
		params: {
			owner: data.owner,
			repo: data.repo,
			pullNumber: data.pullNumber,
			page,
			perPage,
		},
		request: () =>
			context.octokit.rest.pulls.listFiles({
				owner: data.owner,
				repo: data.repo,
				pull_number: data.pullNumber,
				page,
				per_page: perPage,
			}),
		mapData: (files) => ({
			files: files.map((file) => ({
				sha: file.sha,
				filename: file.filename,
				status: file.status as PullFile["status"],
				additions: file.additions,
				deletions: file.deletions,
				changes: file.changes,
				patch: file.patch ?? null,
				previousFilename: file.previous_filename ?? null,
			})),
			nextPage: files.length === perPage ? page + 1 : null,
		}),
	});
}

type GraphQLPullFileSummariesResponse = {
	repository: {
		pullRequest: {
			files: {
				nodes: Array<{
					path: string;
					changeType:
						| "ADDED"
						| "CHANGED"
						| "COPIED"
						| "DELETED"
						| "MODIFIED"
						| "RENAMED";
					additions: number;
					deletions: number;
				}>;
				pageInfo: { hasNextPage: boolean; endCursor: string | null };
			};
		};
	};
};

function mapGraphQLChangeTypeToStatus(
	changeType: GraphQLPullFileSummariesResponse["repository"]["pullRequest"]["files"]["nodes"][number]["changeType"],
): PullFileSummary["status"] {
	switch (changeType) {
		case "ADDED":
			return "added";
		case "DELETED":
			return "removed";
		case "RENAMED":
			return "renamed";
		case "COPIED":
			return "copied";
		case "CHANGED":
			return "changed";
		default:
			return "modified";
	}
}

const PULL_FILE_SUMMARIES_GRAPHQL_QUERY = `query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
	repository(owner: $owner, name: $repo) {
		pullRequest(number: $number) {
			files(first: 100, after: $cursor) {
				nodes { path changeType additions deletions }
				pageInfo { hasNextPage endCursor }
			}
		}
	}
}`;

// GitHub caps GraphQL `first:` at 100 for pullRequest.files, but we can
// loop several pages server-side and return them as one client-visible
// batch. 5 × 100 = 500 summaries per client round-trip cuts a 3k-file PR
// from ~30 client round-trips down to ~6.
const PULL_FILE_SUMMARIES_PAGES_PER_BATCH = 5;

// One batch (up to ~500 files) per call so the client renders incrementally;
// loading all pages server-side blocks a 3k-file PR's sidebar for ~9s.
export async function getPullFileSummariesResult(
	context: GitHubContext,
	data: PullFileSummariesPageInput,
): Promise<PullFileSummariesPage> {
	return dedupeGitHubRead<PullFileSummariesPage>({
		userId: context.session.user.id,
		resource: "pulls.fileSummaries.graphql.batch",
		params: {
			owner: data.owner,
			repo: data.repo,
			pullNumber: data.pullNumber,
			cursor: data.cursor ?? null,
		},
		fetcher: async () => {
			const items: PullFileSummary[] = [];
			let cursor: string | null = data.cursor ?? null;
			let hasNextPage = true;
			const deadlineAt = Date.now() + GITHUB_PAGINATED_OPERATION_TIMEOUT_MS;

			for (let i = 0; i < PULL_FILE_SUMMARIES_PAGES_PER_BATCH; i++) {
				if (!hasNextPage) break;

				const timeoutMs = getRemainingSearchTimeoutMs(
					deadlineAt,
					GITHUB_OPERATION_TIMEOUT_MS,
				);
				if (timeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
					throw new GitHubOperationTimeoutError(
						"github pulls.fileSummaries.graphql.batch",
						timeoutMs,
					);
				}

				const response = await withGitHubOperationTimeout(
					"github pulls.fileSummaries.graphql.batch",
					timeoutMs,
					(signal) =>
						context.octokit.graphql<GraphQLPullFileSummariesResponse>(
							PULL_FILE_SUMMARIES_GRAPHQL_QUERY,
							{
								owner: data.owner,
								repo: data.repo,
								number: data.pullNumber,
								cursor,
								request: { signal },
							},
						),
				);

				const page = response.repository.pullRequest.files;
				for (const node of page.nodes) {
					items.push({
						filename: node.path,
						status: mapGraphQLChangeTypeToStatus(node.changeType),
						additions: node.additions,
						deletions: node.deletions,
						changes: node.additions + node.deletions,
						// GraphQL's PullRequestFile doesn't expose the pre-rename path;
						// the sidebar tree doesn't use it, and the diff view still gets
						// previousFilename via the REST `getPullFiles` endpoint.
						previousFilename: null,
					});
				}

				hasNextPage = page.pageInfo.hasNextPage;
				cursor = page.pageInfo.endCursor ?? null;
			}

			return {
				items,
				nextCursor: hasNextPage ? cursor : null,
			};
		},
	});
}
