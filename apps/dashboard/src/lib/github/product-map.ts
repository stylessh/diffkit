import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import { classifyContentsFile } from "../code-browsing/blob-classify";
import {
	buildMapActivity,
	type IssueInput,
	type MapActivity,
	type PullInput,
	type TreeFile,
} from "../product-map/activity";
import {
	MAP_FILE_PATH,
	type MapFile,
	parseMapFile,
} from "../product-map/map-file";
import { createAreaMatcher } from "../product-map/path-rules";
import { pullParts } from "../product-map/work";
import { executeGitHubGraphQL, fetchGitHubResource } from "./client";
import { getGitHubContextForRepository } from "./installations";
import { getPullFileSummariesResult } from "./pull-files";
import type { GitHubClient, GitHubContext } from "./shared";
import { identityValidator } from "./validators";

export type RepoProductMapInput = { owner: string; repo: string };

export type RepoProductMapFile =
	| { status: "missing" }
	| { status: "invalid"; problems: string[] }
	| { status: "ready"; map: MapFile };

type ContentsData = Awaited<
	ReturnType<GitHubClient["rest"]["repos"]["getContent"]>
>["data"];
type GitTreeData = Awaited<
	ReturnType<GitHubClient["rest"]["git"]["getTree"]>
>["data"];
type IssueListData = Awaited<
	ReturnType<GitHubClient["rest"]["issues"]["listForRepo"]>
>["data"];

function statusOf(error: unknown) {
	return error instanceof RequestError ? error.status : undefined;
}

async function readMapFile(
	context: GitHubContext,
	data: RepoProductMapInput,
): Promise<RepoProductMapFile> {
	try {
		return await fetchGitHubResource<ContentsData, RepoProductMapFile>({
			context,
			resource: "productMap.file.v1",
			params: data,
			request: (signal) =>
				context.octokit.rest.repos.getContent({
					owner: data.owner,
					repo: data.repo,
					path: MAP_FILE_PATH,
					request: { signal },
				}),
			mapData: (content) => {
				if (Array.isArray(content) || content.type !== "file")
					return { status: "missing" };
				const blob = classifyContentsFile(content);
				if (blob.kind !== "text")
					return {
						status: "invalid",
						problems: ["The file must be JSON text of at most 1 MB."],
					};
				const parsed = parseMapFile(blob.text);
				return parsed.ok
					? { status: "ready", map: parsed.map }
					: { status: "invalid", problems: parsed.problems };
			},
		});
	} catch (error) {
		if (statusOf(error) === 404) return { status: "missing" };
		throw error;
	}
}

/** The repository's `.diffkit/map.json` on its default branch, checked. */
export const getRepoProductMapFile = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoProductMapInput>)
	.handler(async ({ data }): Promise<RepoProductMapFile> => {
		const context = await getGitHubContextForRepository(data);
		return context ? readMapFile(context, data) : { status: "missing" };
	});

async function readTree(context: GitHubContext, data: RepoProductMapInput) {
	try {
		return await fetchGitHubResource<
			GitTreeData,
			{ files: TreeFile[]; truncated: boolean }
		>({
			context,
			resource: "productMap.tree.v1",
			params: data,
			request: (signal) =>
				context.octokit.rest.git.getTree({
					owner: data.owner,
					repo: data.repo,
					tree_sha: "HEAD",
					recursive: "1",
					request: { signal },
				}),
			mapData: (tree) => ({
				truncated: tree.truncated,
				files: tree.tree.flatMap((item) =>
					item.type === "blob" && item.path
						? [{ path: item.path, size: item.size ?? null }]
						: [],
				),
			}),
		});
	} catch (error) {
		// 409: the repository has no commits yet.
		if (statusOf(error) === 409) return { files: [], truncated: false };
		throw error;
	}
}

/** Pages of 50 pull requests, each with its first 100 changed files. */
const MAX_PULL_PAGES = 6;
const PULLS_DEADLINE_MS = 20_000;

type PullsWithFilesResponse = {
	repository: {
		pullRequests: {
			nodes: {
				number: number;
				title: string;
				state: "OPEN" | "MERGED" | "CLOSED";
				createdAt: string;
				mergedAt: string | null;
				author: {
					__typename: string;
					login: string;
					avatarUrl: string;
				} | null;
				files: {
					totalCount: number;
					nodes: { path: string; additions: number; deletions: number }[];
				} | null;
			}[];
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
		};
	} | null;
};

const PULLS_WITH_FILES_QUERY = `query($owner: String!, $repo: String!, $cursor: String) {
	repository(owner: $owner, name: $repo) {
		pullRequests(
			first: 50
			after: $cursor
			states: [OPEN, MERGED]
			orderBy: { field: UPDATED_AT, direction: DESC }
		) {
			nodes {
				number
				title
				state
				createdAt
				mergedAt
				author {
					__typename
					login
					avatarUrl
				}
				files(first: 100) {
					totalCount
					nodes {
						path
						additions
						deletions
					}
				}
			}
			pageInfo {
				hasNextPage
				endCursor
			}
		}
	}
}`;

/**
 * The most recently updated open and merged pull requests with their changed
 * files. Bounded in pages and time, so a large repository gets its recent
 * history and a note that older work is not counted.
 */
async function readPulls(context: GitHubContext, data: RepoProductMapInput) {
	const pulls: PullInput[] = [];
	const startedAt = Date.now();
	let cursor: string | null = null;
	for (let page = 0; page < MAX_PULL_PAGES; page++) {
		const response: PullsWithFilesResponse = await executeGitHubGraphQL(
			context,
			`github product map pulls ${data.owner}/${data.repo}`,
			PULLS_WITH_FILES_QUERY,
			{ owner: data.owner, repo: data.repo, cursor },
		);
		const connection = response.repository?.pullRequests;
		if (!connection) break;
		for (const node of connection.nodes) {
			const merged = node.state === "MERGED";
			pulls.push({
				number: node.number,
				title: node.title,
				state: merged ? "merged" : "open",
				author: node.author?.login ?? "ghost",
				authorAvatarUrl: node.author?.avatarUrl ?? null,
				bot: node.author?.__typename === "Bot",
				date: (merged && node.mergedAt) || node.createdAt,
				files: node.files?.nodes ?? [],
				filesTruncated:
					(node.files?.totalCount ?? 0) > (node.files?.nodes.length ?? 0),
			});
		}
		cursor = connection.pageInfo.endCursor;
		if (!(connection.pageInfo.hasNextPage && cursor))
			return { pulls, truncated: false };
		if (Date.now() - startedAt > PULLS_DEADLINE_MS) break;
	}
	return { pulls, truncated: true };
}

async function readOpenIssues(
	context: GitHubContext,
	data: RepoProductMapInput,
) {
	return fetchGitHubResource<IssueListData, IssueInput[]>({
		context,
		resource: "productMap.openIssues.v1",
		params: data,
		request: (signal) =>
			context.octokit.rest.issues.listForRepo({
				owner: data.owner,
				repo: data.repo,
				state: "open",
				per_page: 100,
				request: { signal },
			}),
		mapData: (issues) =>
			issues.flatMap((issue) =>
				issue.pull_request
					? []
					: [
							{
								number: issue.number,
								title: issue.title,
								author: issue.user?.login ?? "ghost",
								date: issue.created_at,
							},
						],
			),
	});
}

/**
 * Everything on the map that is counted rather than written: sizes from the
 * tree, pull requests and their share of each area, people, hinted issues.
 * Null when the repository has no usable map file.
 */
export const getRepoProductMapActivity = createServerFn({ method: "GET" })
	.validator(identityValidator<RepoProductMapInput>)
	.handler(async ({ data }): Promise<MapActivity | null> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return null;
		const file = await readMapFile(context, data);
		if (file.status !== "ready") return null;
		const [tree, pulls, issues] = await Promise.all([
			readTree(context, data),
			readPulls(context, data),
			file.map.issues.length > 0 ? readOpenIssues(context, data) : [],
		]);
		return buildMapActivity({
			map: file.map,
			tree: tree.files,
			pulls: pulls.pulls,
			issues,
			now: new Date(),
			limits: {
				treeTruncated: tree.truncated,
				pullsTruncated: pulls.truncated,
			},
		});
	});

export type PullProductAreasInput = RepoProductMapInput & {
	pullNumber: number;
};

/** One product area a pull request changes, with its share of the changed lines. */
export type PullProductArea = {
	id: string;
	name: string;
	icon: string;
	share: number;
};

/** A pull request can list files in pages of 500; this is as far as the share looks. */
const MAX_FILE_BATCHES = 4;

/**
 * The areas one pull request touches, largest share first, from its own
 * changed files and the repository's map rules. Empty without a usable map.
 */
export const getPullProductAreas = createServerFn({ method: "GET" })
	.validator(identityValidator<PullProductAreasInput>)
	.handler(async ({ data }): Promise<PullProductArea[]> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return [];
		const file = await readMapFile(context, data);
		if (file.status !== "ready") return [];
		const files = [];
		let cursor: string | null = null;
		for (let batch = 0; batch < MAX_FILE_BATCHES; batch++) {
			const page = await getPullFileSummariesResult(context, {
				owner: data.owner,
				repo: data.repo,
				pullNumber: data.pullNumber,
				cursor,
			});
			for (const item of page.items)
				files.push({
					path: item.filename,
					additions: item.additions,
					deletions: item.deletions,
				});
			cursor = page.nextCursor;
			if (!cursor) break;
		}
		const names = new Map(file.map.areas.map((area) => [area.id, area]));
		const match = createAreaMatcher(file.map.rules, file.map.ignore);
		return pullParts(files, match).flatMap((part) => {
			const area = names.get(part.area);
			return area
				? [{ id: area.id, name: area.name, icon: area.icon, share: part.share }]
				: [];
		});
	});
