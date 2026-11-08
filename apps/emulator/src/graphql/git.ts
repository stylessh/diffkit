import type {
	GitHubCommit,
	GitHubRepo,
	GitHubStore,
	GitHubTree,
} from "@emulators/github";

export function findCommit(gh: GitHubStore, repoId: number, sha: string) {
	return gh.commits
		.findBy("repo_id", repoId)
		.find((commit) => commit.sha === sha);
}

export function findTree(gh: GitHubStore, repoId: number, sha: string) {
	return gh.trees.findBy("repo_id", repoId).find((tree) => tree.sha === sha);
}

/** Resolves a branch, tag, `HEAD` or (abbreviated) sha to a commit. */
export function resolveRevision(
	gh: GitHubStore,
	repo: GitHubRepo,
	revision: string,
): GitHubCommit | undefined {
	const name =
		revision === "HEAD"
			? repo.default_branch
			: revision.replace(/^refs\/(heads|tags)\//u, "");
	const branch = gh.branches
		.findBy("repo_id", repo.id)
		.find((row) => row.name === name);
	if (branch) {
		return findCommit(gh, repo.id, branch.sha);
	}
	const tagRef = gh.refs
		.findBy("repo_id", repo.id)
		.find((row) => row.ref === `refs/tags/${name}`);
	if (tagRef) {
		const annotated = gh.tags
			.findBy("repo_id", repo.id)
			.find((tag) => tag.sha === tagRef.sha);
		return findCommit(gh, repo.id, annotated?.object_sha ?? tagRef.sha);
	}
	if (/^[0-9a-f]{4,40}$/iu.test(revision)) {
		return gh.commits
			.findBy("repo_id", repo.id)
			.find((commit) => commit.sha.startsWith(revision.toLowerCase()));
	}
	return undefined;
}

export type TreeEntry = GitHubTree["tree"][number];

/** Walks nested trees to find the entry at `path` ("" is the root tree). */
export function lookupPath(
	gh: GitHubStore,
	repoId: number,
	rootTreeSha: string,
	path: string,
): { type: "tree" | "blob" | "commit"; sha: string } | null {
	const parts = path.split("/").filter(Boolean);
	if (parts.length === 0) {
		return { type: "tree", sha: rootTreeSha };
	}
	let treeSha = rootTreeSha;
	for (let index = 0; index < parts.length; index++) {
		const tree = findTree(gh, repoId, treeSha);
		if (!tree) {
			return null;
		}
		const remaining = parts.slice(index).join("/");
		// emulate stores flattened paths in some trees; prefer an exact match.
		const exact = tree.tree.find((entry) => entry.path === remaining);
		if (exact) {
			return { type: exact.type, sha: exact.sha };
		}
		const entry = tree.tree.find(
			(candidate) => candidate.path === parts[index],
		);
		if (!entry) {
			return null;
		}
		if (index === parts.length - 1) {
			return { type: entry.type, sha: entry.sha };
		}
		if (entry.type !== "tree") {
			return null;
		}
		treeSha = entry.sha;
	}
	return null;
}

/** Commits reachable from `headSha`, newest committer date first. */
export function ancestors(
	gh: GitHubStore,
	repoId: number,
	headSha: string,
	limit = 5000,
): GitHubCommit[] {
	const bySha = new Map(
		gh.commits.findBy("repo_id", repoId).map((commit) => [commit.sha, commit]),
	);
	const seen = new Set<string>();
	const queue = [headSha];
	const result: GitHubCommit[] = [];
	while (queue.length > 0 && result.length < limit) {
		const sha = queue.shift() as string;
		if (seen.has(sha)) {
			continue;
		}
		seen.add(sha);
		const commit = bySha.get(sha);
		if (!commit) {
			continue;
		}
		result.push(commit);
		queue.push(...commit.parent_shas);
	}
	return result.sort(
		(a, b) => b.committer_date.localeCompare(a.committer_date) || b.id - a.id,
	);
}

/** Commits in `head` that are not reachable from `base` (oldest first). */
export function commitsBetween(
	gh: GitHubStore,
	repoId: number,
	baseSha: string,
	headSha: string,
) {
	const baseSet = new Set(
		ancestors(gh, repoId, baseSha).map((commit) => commit.sha),
	);
	return ancestors(gh, repoId, headSha)
		.filter((commit) => !baseSet.has(commit.sha))
		.reverse();
}

/** Commits on the ancestry of `headSha` that changed `path`. */
export function historyForPath(
	gh: GitHubStore,
	repoId: number,
	headSha: string,
	path: string | null | undefined,
) {
	const commits = ancestors(gh, repoId, headSha);
	if (!path) {
		return commits;
	}
	return commits.filter((commit) => {
		const current = lookupPath(gh, repoId, commit.tree_sha, path)?.sha ?? null;
		if (commit.parent_shas.length === 0) {
			return current !== null;
		}
		return commit.parent_shas.every((parentSha) => {
			const parent = findCommit(gh, repoId, parentSha);
			const previous = parent
				? (lookupPath(gh, repoId, parent.tree_sha, path)?.sha ?? null)
				: null;
			return previous !== current;
		});
	});
}

export type ConnectionArgs = {
	first?: number | null;
	after?: string | null;
	last?: number | null;
	before?: string | null;
};

function encodeCursor(index: number) {
	return Buffer.from(`cursor:${index}`).toString("base64");
}

function decodeCursor(cursor: string | null | undefined) {
	if (!cursor) {
		return null;
	}
	const match = Buffer.from(cursor, "base64")
		.toString("utf8")
		.match(/^cursor:(\d+)$/u);
	return match ? Number(match[1]) : null;
}

/** Relay-style slice of an in-memory list. */
export function connection<T>(items: T[], args: ConnectionArgs = {}) {
	let start = 0;
	let end = items.length;
	const after = decodeCursor(args.after);
	const before = decodeCursor(args.before);
	if (after !== null) start = after + 1;
	if (before !== null) end = Math.min(end, before);
	if (typeof args.first === "number") end = Math.min(end, start + args.first);
	if (typeof args.last === "number") start = Math.max(start, end - args.last);
	const nodes = items.slice(start, end);
	return {
		nodes,
		totalCount: items.length,
		pageInfo: {
			hasNextPage: end < items.length,
			hasPreviousPage: start > 0,
			startCursor: nodes.length > 0 ? encodeCursor(start) : null,
			endCursor: nodes.length > 0 ? encodeCursor(end - 1) : null,
		},
	};
}
