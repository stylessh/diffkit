import type { GitHubPullRequest, GitHubRepo } from "@emulators/github";
import { findCommit, lookupPath } from "../graphql/git.ts";
import type { ShimContext } from "../server.ts";
import { stores } from "./common.ts";

export type PullFileJson = {
	sha: string;
	filename: string;
	status: "added" | "removed" | "modified" | "renamed";
	additions: number;
	deletions: number;
	changes: number;
	previous_filename?: string;
	patch?: string;
};

type ComparisonJson = {
	files?: PullFileJson[];
	merge_base_commit?: { sha: string; commit: { tree: { sha: string } } };
};

/** GitHub's diff media type refuses pull requests with more files than this. */
export const DIFF_MAX_FILES = 300;
/** emulate's compare stops listing files here; its commit endpoint goes to 3000. */
const COMPARE_FILE_LIMIT = 300;

export type PullFiles = {
	files: PullFileJson[];
	mergeBaseTreeSha: string | null;
};

export async function loadPullFiles(
	context: ShimContext,
	repo: GitHubRepo,
	pull: GitHubPullRequest,
	authorization: string,
): Promise<PullFiles | null> {
	const headers = { Authorization: authorization };
	const response = await context.internalFetch(
		`/repos/${repo.full_name}/compare/${pull.base_sha}...${pull.head_sha}`,
		{ headers },
	);
	if (!response.ok) return null;
	const comparison = (await response.json()) as ComparisonJson;
	const files = comparison.files ?? [];
	const mergeBase = comparison.merge_base_commit;
	const mergeBaseTreeSha = mergeBase?.commit.tree.sha ?? null;
	if (files.length < COMPARE_FILE_LIMIT || !mergeBase) {
		return { files, mergeBaseTreeSha };
	}
	// GitHub lists up to 3000 PR files. For a single-commit PR the commit's own
	// file list is exactly the PR's, and emulate does not cap that one at 300.
	const head = findCommit(stores(context).gh, repo.id, pull.head_sha);
	if (head?.parent_shas.length !== 1 || head.parent_shas[0] !== mergeBase.sha) {
		return { files, mergeBaseTreeSha };
	}
	const commitFiles: PullFileJson[] = [];
	for (let page = 1; ; page++) {
		const commitResponse = await context.internalFetch(
			`/repos/${repo.full_name}/commits/${pull.head_sha}?per_page=100&page=${page}`,
			{ headers },
		);
		if (!commitResponse.ok) return { files, mergeBaseTreeSha };
		const batch =
			((await commitResponse.json()) as { files?: PullFileJson[] }).files ?? [];
		commitFiles.push(...batch);
		if (batch.length < 100) return { files: commitFiles, mergeBaseTreeSha };
	}
}

const NULL_SHA = "0000000";
const short = (sha: string) => sha.slice(0, 7);

/**
 * Renders PR files the way `git diff` (and GitHub's diff media type) does.
 * `baseBlobSha` resolves a modified file's pre-image blob for the index line.
 */
export function formatGitDiff(
	files: readonly PullFileJson[],
	baseBlobSha: (path: string) => string | null,
): string {
	const out: string[] = [];
	for (const file of files) {
		const before = file.previous_filename ?? file.filename;
		out.push(`diff --git a/${before} b/${file.filename}`);
		switch (file.status) {
			case "added":
				out.push(
					"new file mode 100644",
					`index ${NULL_SHA}..${short(file.sha)}`,
				);
				break;
			case "removed":
				out.push(
					"deleted file mode 100644",
					`index ${short(file.sha)}..${NULL_SHA}`,
				);
				break;
			case "renamed":
				out.push(
					`similarity index ${file.patch ? 90 : 100}%`,
					`rename from ${before}`,
					`rename to ${file.filename}`,
				);
				break;
			case "modified":
				out.push(
					`index ${short(baseBlobSha(file.filename) ?? NULL_SHA)}..${short(file.sha)} 100644`,
				);
				break;
		}
		if (file.patch) {
			out.push(
				`--- ${file.status === "added" ? "/dev/null" : `a/${before}`}`,
				`+++ ${file.status === "removed" ? "/dev/null" : `b/${file.filename}`}`,
				file.patch,
			);
		} else if (file.status !== "renamed") {
			out.push(`Binary files a/${before} and b/${file.filename} differ`);
		}
	}
	return out.length === 0 ? "" : `${out.join("\n")}\n`;
}

export function tooLargeDiffBody() {
	return {
		message: `Sorry, the diff exceeded the maximum number of files (${DIFF_MAX_FILES}). Consider using 'List pull requests files' API or locally cloning the repository instead.`,
		errors: [{ resource: "PullRequest", field: "diff", code: "too_large" }],
		documentation_url:
			"https://docs.github.com/rest/pulls/pulls#list-pull-requests-files",
		status: "406",
	};
}

export function baseBlobLookup(
	context: ShimContext,
	repo: GitHubRepo,
	mergeBaseTreeSha: string | null,
) {
	const { gh } = stores(context);
	return (path: string) =>
		mergeBaseTreeSha
			? (lookupPath(gh, repo.id, mergeBaseTreeSha, path)?.sha ?? null)
			: null;
}
