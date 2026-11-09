import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type GitHubQueryScope,
	githubRepoTreeQueryOptions,
} from "#/lib/github.query";
import {
	type DirectoryListing,
	useTreeIndex,
} from "./code/use-directory-listing";

export type ExplorerContext = {
	owner: string;
	repoName: string;
	currentRef: string;
	scope: GitHubQueryScope;
};

export type ExplorerDirectories = {
	/** `undefined` until the directory has been asked for. */
	listing: (dir: string) => DirectoryListing | undefined;
	/** Lists a directory unless the complete recursive tree answers it; a failed one is retried. */
	load: (dir: string) => void;
	/** Every known path, directories with a trailing slash, parents first. */
	paths: readonly string[];
};

const LOADING: DirectoryListing = { status: "loading" };

/**
 * The repo's directories for the explorer tree. A complete recursive tree
 * answers every directory at once; while it loads, or when GitHub truncated
 * it, directories are listed on their own (contents API) as they are opened,
 * seeded with whatever the partial tree already knows.
 */
export function useExplorerDirectories(
	context: ExplorerContext,
): ExplorerDirectories {
	const { owner, repoName, currentRef, scope } = context;
	const queryClient = useQueryClient();
	const indexQuery = useTreeIndex(scope, {
		owner,
		repo: repoName,
		ref: currentRef,
	});
	const index = indexQuery.data;
	const complete = index !== undefined && !index.truncated;
	const fetchedRef = useRef<ReadonlyMap<string, DirectoryListing>>(new Map());
	const [fetched, setFetched] = useState(fetchedRef.current);

	const listing = useCallback(
		(dir: string): DirectoryListing | undefined => {
			if (complete) {
				const entries = index.children.get(dir);
				return entries ? { status: "ready", entries } : { status: "missing" };
			}
			const own = fetched.get(dir);
			if (own && own.status !== "loading") return own;
			const partial = index?.children.get(dir);
			return partial ? { status: "ready", entries: partial } : own;
		},
		[complete, fetched, index],
	);

	const load = useCallback(
		(dir: string) => {
			const known = fetchedRef.current.get(dir);
			if (complete || (known && known.status !== "error")) return;
			const settle = (result: DirectoryListing) => {
				fetchedRef.current = new Map(fetchedRef.current).set(dir, result);
				setFetched(fetchedRef.current);
			};
			settle(LOADING);
			queryClient
				.fetchQuery(
					githubRepoTreeQueryOptions(scope, {
						owner,
						repo: repoName,
						ref: currentRef,
						path: dir,
					}),
				)
				.then(
					(entries) => settle({ status: "ready", entries }),
					(error: Error) => settle({ status: "error", error }),
				);
		},
		[complete, currentRef, owner, queryClient, repoName, scope],
	);

	useEffect(() => {
		const loadRoot = () => load("");
		loadRoot();
		window.addEventListener("focus", loadRoot);
		return () => window.removeEventListener("focus", loadRoot);
	}, [load]);

	const paths = useMemo(() => {
		const out: string[] = [];
		const visit = (dir: string) => {
			const current = listing(dir);
			if (current?.status !== "ready") return;
			for (const entry of current.entries) {
				if (entry.type === "dir") {
					out.push(`${entry.path}/`);
					visit(entry.path);
				} else {
					out.push(entry.path);
				}
			}
		};
		visit("");
		return out;
	}, [listing]);

	return useMemo(() => ({ listing, load, paths }), [listing, load, paths]);
}
