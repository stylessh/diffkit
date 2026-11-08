import { useQuery } from "@tanstack/react-query";
import {
	type GitHubQueryScope,
	githubRepoTreeIndexQueryOptions,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import type { RepoTreeEntry } from "#/lib/github.types";

export type DirectoryListing =
	| { status: "loading" }
	| { status: "ready"; entries: RepoTreeEntry[] }
	| { status: "missing" }
	| { status: "error"; error: Error };

type DirectoryInput = {
	owner: string;
	repo: string;
	ref: string;
	path: string;
};

export function useTreeIndex(
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; ref: string },
	enabled = true,
) {
	return useQuery({
		...githubRepoTreeIndexQueryOptions(scope, input),
		enabled,
	});
}

/**
 * A complete recursive tree answers every directory instantly. While it loads,
 * or when GitHub truncated it, the directory is listed on its own (contents
 * API), seeded with whatever the partial tree already knows.
 */
export function useDirectoryListing(
	scope: GitHubQueryScope,
	input: DirectoryInput,
	enabled = true,
): DirectoryListing {
	const { owner, repo, ref, path } = input;
	const indexQuery = useTreeIndex(scope, { owner, repo, ref }, enabled);
	const index = indexQuery.data;
	const indexed = index?.children.get(path);
	const complete = index !== undefined && !index.truncated;

	const contentsQuery = useQuery({
		...githubRepoTreeQueryOptions(scope, input),
		enabled: enabled && !complete,
		placeholderData: indexed,
	});

	if (complete) {
		return indexed
			? { status: "ready", entries: indexed }
			: { status: "missing" };
	}
	if (contentsQuery.data)
		return { status: "ready", entries: contentsQuery.data };
	if (contentsQuery.error)
		return { status: "error", error: contentsQuery.error };
	return { status: "loading" };
}
