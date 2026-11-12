import { createServerFn } from "@tanstack/react-start";
import { RequestError } from "octokit";
import {
	buildMapActivity,
	type IssueInput,
	type MapActivity,
	type PullInput,
	type TreeFile,
} from "../product-map/activity";
import { type MapFile, parseMapFolder } from "../product-map/map-file";
import { createAreaMatcher } from "../product-map/path-rules";
import { pullParts } from "../product-map/work";
import { executeGitHubGraphQL, fetchGitHubResource } from "./client";
import { getGitHubContextForRepository } from "./installations";
import { getPullFileSummariesResult } from "./pull-files";
import { dedupeGitHubRead } from "./request-dedup";
import type { GitHubClient, GitHubContext } from "./shared";
import { identityValidator } from "./validators";

export type RepoProductMapInput = { owner: string; repo: string };

export type RepoProductMapFile =
	| { status: "missing" }
	| { status: "invalid"; problems: string[] }
	| { status: "ready"; map: MapFile };

type GitTreeData = Awaited<
	ReturnType<GitHubClient["rest"]["git"]["getTree"]>
>["data"];
type IssueListData = Awaited<
	ReturnType<GitHubClient["rest"]["issues"]["listForRepo"]>
>["data"];

function statusOf(error: unknown) {
	return error instanceof RequestError ? error.status : undefined;
}

type MapFolderResponse = {
	repository: {
		index: { text: string | null; isTruncated: boolean } | null;
		areas: {
			entries:
				| {
						name: string;
						type: string;
						object: { text: string | null; isTruncated: boolean } | null;
				  }[]
				| null;
		} | null;
	} | null;
};

const MAP_FOLDER_QUERY = `query($owner: String!, $repo: String!) {
	repository(owner: $owner, name: $repo) {
		index: object(expression: "HEAD:.diffkit/map.json") {
			... on Blob {
				text
				isTruncated
			}
		}
		areas: object(expression: "HEAD:.diffkit/areas") {
			... on Tree {
				entries {
					name
					type
					object {
						... on Blob {
							text
							isTruncated
						}
					}
				}
			}
		}
	}
}`;

/** The whole `.diffkit` folder on the default branch, in one request. */
async function readMapFile(
	context: GitHubContext,
	data: RepoProductMapInput,
): Promise<RepoProductMapFile> {
	const response = await dedupeGitHubRead({
		userId: context.session.user.id,
		resource: "productMap.folder.v1",
		params: data,
		fetcher: () =>
			executeGitHubGraphQL<MapFolderResponse>(
				context,
				`github product map folder ${data.owner}/${data.repo}`,
				MAP_FOLDER_QUERY,
				{ owner: data.owner, repo: data.repo },
			),
	});
	const index = response.repository?.index;
	if (!index) return { status: "missing" };
	const files = (response.repository?.areas?.entries ?? []).filter(
		(entry) => entry.type === "blob",
	);
	const unreadable = [
		...(index.text === null || index.isTruncated ? ["map.json"] : []),
		...files
			.filter((file) => !file.object?.text || file.object.isTruncated)
			.map((file) => `areas/${file.name}`),
	];
	if (unreadable.length > 0)
		return {
			status: "invalid",
			problems: unreadable.map(
				(name) => `${name} must be JSON text that GitHub can return whole.`,
			),
		};
	const parsed = parseMapFolder({
		index: index.text ?? "",
		areas: files.map((file) => ({
			name: file.name,
			text: file.object?.text ?? "",
		})),
	});
	return parsed.ok
		? { status: "ready", map: parsed.map }
		: { status: "invalid", problems: parsed.problems };
}

/** The repository's `.diffkit` folder on its default branch, checked. */
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

const ISSUES_PER_PAGE = 100;
const MAX_ISSUE_PAGES = 10;

/**
 * The open issues among the ones the map hints at. GitHub lists open issues a
 * page at a time, so this reads on until every hinted number has been seen or
 * the open issues run out.
 */
async function readOpenIssues(
	context: GitHubContext,
	data: RepoProductMapInput,
	hinted: ReadonlySet<number>,
) {
	const found: IssueInput[] = [];
	for (let page = 1; page <= MAX_ISSUE_PAGES; page++) {
		const listing = { ...data, page };
		const batch = await fetchGitHubResource<
			IssueListData,
			{ issues: IssueInput[]; size: number }
		>({
			context,
			resource: "productMap.openIssues.v2",
			params: listing,
			request: (signal) =>
				context.octokit.rest.issues.listForRepo({
					owner: data.owner,
					repo: data.repo,
					state: "open",
					per_page: ISSUES_PER_PAGE,
					page,
					request: { signal },
				}),
			mapData: (issues) => ({
				size: issues.length,
				issues: issues.flatMap((issue) =>
					issue.pull_request || !hinted.has(issue.number)
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
			}),
		});
		found.push(...batch.issues);
		if (batch.size < ISSUES_PER_PAGE || found.length === hinted.size) break;
	}
	return found;
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
			file.map.issues.length > 0
				? readOpenIssues(
						context,
						data,
						new Set(file.map.issues.map((issue) => issue.number)),
					)
				: [],
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

export type PullProductAreas = {
	/** Largest share first. */
	areas: PullProductArea[];
	/** Changed files that are neither in an area nor ignored: the map is behind. */
	unmappedFiles: number;
};

const NO_PRODUCT_AREAS: PullProductAreas = { areas: [], unmappedFiles: 0 };

/** A pull request can list files in pages of 500; this is as far as the share looks. */
const MAX_FILE_BATCHES = 4;

/**
 * The areas one pull request touches, from its own changed files and the
 * repository's map, and how many of its files the map does not cover yet.
 */
export const getPullProductAreas = createServerFn({ method: "GET" })
	.validator(identityValidator<PullProductAreasInput>)
	.handler(async ({ data }): Promise<PullProductAreas> => {
		const context = await getGitHubContextForRepository(data);
		if (!context) return NO_PRODUCT_AREAS;
		const file = await readMapFile(context, data);
		if (file.status !== "ready") return NO_PRODUCT_AREAS;
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
					removed: item.status === "removed",
				});
			cursor = page.nextCursor;
			if (!cursor) break;
		}
		const names = new Map(file.map.areas.map((area) => [area.id, area]));
		const match = createAreaMatcher(file.map.rules, file.map.ignore);
		return {
			areas: pullParts(files, match).flatMap((part) => {
				const area = names.get(part.area);
				return area
					? [
							{
								id: area.id,
								name: area.name,
								icon: area.icon,
								share: part.share,
							},
						]
					: [];
			}),
			unmappedFiles: files.filter(
				(item) => !item.removed && match(item.path).kind === "unmapped",
			).length,
		};
	});
