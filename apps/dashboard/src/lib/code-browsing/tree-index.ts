import type { FileSearchEntry } from "#/lib/fuzzy-file-search";
import type { RepoTreeEntry } from "#/lib/github.types";
import type { CodeTreeEntry, RepoGitTree } from "./types";

/** When GitHub truncated the tree, any directory's children may be incomplete. */
export type TreeIndex = {
	truncated: boolean;
	children: ReadonlyMap<string, RepoTreeEntry[]>;
	entries: ReadonlyMap<string, RepoTreeEntry>;
	finderEntries: FileSearchEntry[];
};

export function parentPath(path: string) {
	const slash = path.lastIndexOf("/");
	return slash === -1 ? "" : path.slice(0, slash);
}

export function baseName(path: string) {
	return path.slice(path.lastIndexOf("/") + 1);
}

export function compareTreeEntries(a: RepoTreeEntry, b: RepoTreeEntry) {
	if (a.type === "dir" && b.type !== "dir") return -1;
	if (a.type !== "dir" && b.type === "dir") return 1;
	return a.name.localeCompare(b.name);
}

function toRepoTreeEntry(entry: CodeTreeEntry): RepoTreeEntry {
	return {
		name: baseName(entry.path),
		type: entry.type,
		path: entry.path,
		sha: entry.sha,
		size: entry.size,
		lastCommit: null,
	};
}

export function buildTreeIndex(tree: RepoGitTree): TreeIndex {
	const children = new Map<string, RepoTreeEntry[]>([["", []]]);
	const entries = new Map<string, RepoTreeEntry>();
	const finderEntries: FileSearchEntry[] = [];

	for (const raw of tree.entries) {
		const entry = toRepoTreeEntry(raw);
		entries.set(entry.path, entry);
		finderEntries.push({
			path: entry.path,
			name: entry.name,
			type: entry.type,
		});
		if (entry.type === "dir" && !children.has(entry.path)) {
			children.set(entry.path, []);
		}
		const parent = parentPath(entry.path);
		const siblings = children.get(parent);
		if (siblings) {
			siblings.push(entry);
		} else {
			children.set(parent, [entry]);
		}
	}

	for (const list of children.values()) list.sort(compareTreeEntries);

	return { truncated: tree.truncated, children, entries, finderEntries };
}

const indexByTree = new WeakMap<RepoGitTree, TreeIndex>();

/** Every tree observer selects the same index instead of rebuilding it. */
export function treeIndexFor(tree: RepoGitTree): TreeIndex {
	let index = indexByTree.get(tree);
	if (!index) {
		index = buildTreeIndex(tree);
		indexByTree.set(tree, index);
	}
	return index;
}
