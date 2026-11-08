/**
 * `Commit.blame(path:)` and `Commit.parents`, which emulate has no notion of.
 * Lines are attributed by walking the first-parent history of the path and
 * matching each version against its parent with an LCS diff.
 */
import type { GitHubCommit, GitHubRepo, GitHubStore } from "@emulators/github";
import { findCommit, lookupPath } from "./git.ts";
import type { GraphQLContext } from "./resolvers.ts";

export const blameTypeDefs = /* GraphQL */ `
	extend type Commit {
		blame(path: String!): Blame!
		parents(first: Int, after: String): CommitParentConnection!
	}

	type Blame {
		ranges: [BlameRange!]!
	}

	type BlameRange {
		startingLine: Int!
		endingLine: Int!
		age: Int!
		commit: Commit!
	}

	type CommitParentConnection {
		nodes: [Commit]
		totalCount: Int!
	}
`;

type CommitModel = { commit: GitHubCommit; repo: GitHubRepo };

type FileVersion = { sha: string; lines: string[] };

function fileVersion(
	gh: GitHubStore,
	repo: GitHubRepo,
	commit: GitHubCommit,
	path: string,
): FileVersion | null {
	const entry = lookupPath(gh, repo.id, commit.tree_sha, path);
	if (!entry || entry.type !== "blob") return null;
	const blob = gh.blobs
		.findBy("repo_id", repo.id)
		.find((row) => row.sha === entry.sha);
	if (!blob) return null;
	const text =
		blob.encoding === "base64"
			? Buffer.from(blob.content, "base64").toString("utf8")
			: blob.content;
	return { sha: entry.sha, lines: text.replace(/\n$/u, "").split("\n") };
}

export function matchLines(previous: string[], next: string[]): number[] {
	const rows = next.length + 1;
	const cols = previous.length + 1;
	const table = new Uint32Array(rows * cols);
	for (let i = next.length - 1; i >= 0; i--) {
		for (let j = previous.length - 1; j >= 0; j--) {
			table[i * cols + j] =
				next[i] === previous[j]
					? table[(i + 1) * cols + j + 1] + 1
					: Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
		}
	}
	const matches = new Array<number>(next.length).fill(-1);
	let i = 0;
	let j = 0;
	while (i < next.length && j < previous.length) {
		if (next[i] === previous[j]) {
			matches[i] = j;
			i++;
			j++;
		} else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) {
			i++;
		} else {
			j++;
		}
	}
	return matches;
}

export function blameLines(
	gh: GitHubStore,
	repo: GitHubRepo,
	head: GitHubCommit,
	path: string,
): GitHubCommit[] | null {
	const headVersion = fileVersion(gh, repo, head, path);
	if (!headVersion) return null;
	const owners = new Array<GitHubCommit | null>(headVersion.lines.length).fill(
		null,
	);
	let positions = headVersion.lines.map((_, index) => index);
	let commit = head;
	let version = headVersion;

	while (positions.some((position) => position >= 0)) {
		const parent = commit.parent_shas[0]
			? findCommit(gh, repo.id, commit.parent_shas[0])
			: undefined;
		const parentVersion = parent ? fileVersion(gh, repo, parent, path) : null;
		if (parent && parentVersion?.sha === version.sha) {
			commit = parent;
			continue;
		}
		const matches = parentVersion
			? matchLines(parentVersion.lines, version.lines)
			: version.lines.map(() => -1);
		positions = positions.map((position, line) => {
			if (position < 0) return position;
			const previous = matches[position];
			if (previous < 0) owners[line] = commit;
			return previous;
		});
		if (!parent || !parentVersion) break;
		commit = parent;
		version = parentVersion;
	}
	return owners.map((owner) => owner ?? commit);
}

function ageBuckets(commits: GitHubCommit[]) {
	const dates = [...new Set(commits.map((commit) => commit.committer_date))]
		.sort()
		.reverse();
	return (commit: GitHubCommit) => {
		const rank = dates.indexOf(commit.committer_date);
		return dates.length <= 1
			? 1
			: 1 + Math.round((rank / (dates.length - 1)) * 9);
	};
}

export const blameResolvers = {
	Commit: {
		blame: (
			model: CommitModel,
			args: { path: string },
			ctx: GraphQLContext,
		) => {
			const owners = blameLines(ctx.gh, model.repo, model.commit, args.path);
			if (!owners) {
				throw new Error(`Could not resolve file for path '${args.path}'.`);
			}
			const age = ageBuckets(owners);
			const ranges: Array<{
				startingLine: number;
				endingLine: number;
				age: number;
				commit: CommitModel & { __typename: "Commit" };
			}> = [];
			owners.forEach((owner, index) => {
				const last = ranges.at(-1);
				if (last && last.commit.commit.sha === owner.sha) {
					last.endingLine = index + 1;
					return;
				}
				ranges.push({
					startingLine: index + 1,
					endingLine: index + 1,
					age: age(owner),
					commit: { __typename: "Commit", commit: owner, repo: model.repo },
				});
			});
			return { ranges };
		},
		parents: (
			model: CommitModel,
			args: { first?: number },
			ctx: GraphQLContext,
		) => {
			const parents = model.commit.parent_shas.flatMap((sha) => {
				const commit = findCommit(ctx.gh, model.repo.id, sha);
				return commit
					? [{ __typename: "Commit" as const, commit, repo: model.repo }]
					: [];
			});
			return {
				nodes: parents.slice(0, args.first ?? parents.length),
				totalCount: parents.length,
			};
		},
	},
};
