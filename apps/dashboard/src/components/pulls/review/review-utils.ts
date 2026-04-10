import type { PullFile, PullFileSummary } from "#/lib/github.types";
import type { FileTreeNode } from "./review-types";

type FileTreeEntry = Pick<
	PullFileSummary,
	"filename" | "status" | "additions" | "deletions"
>;

export function buildFileTree(files: FileTreeEntry[]): FileTreeNode[] {
	const root: FileTreeNode = {
		name: "",
		path: "",
		type: "directory",
		children: [],
	};

	for (const file of files) {
		const parts = file.filename.split("/");
		let current = root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isFile = i === parts.length - 1;

			let child = current.children.find((node) => node.name === part);
			if (!child) {
				child = {
					name: part,
					path: parts.slice(0, i + 1).join("/"),
					type: isFile ? "file" : "directory",
					status: isFile ? file.status : undefined,
					additions: isFile ? file.additions : undefined,
					deletions: isFile ? file.deletions : undefined,
					children: [],
				};
				current.children.push(child);
			}
			current = child;
		}
	}

	function collapse(node: FileTreeNode): FileTreeNode {
		if (
			node.type === "directory" &&
			node.children.length === 1 &&
			node.children[0].type === "directory"
		) {
			const child = node.children[0];
			return collapse({
				...child,
				name: `${node.name}/${child.name}`,
				children: child.children,
			});
		}

		return {
			...node,
			children: node.children.map(collapse),
		};
	}

	function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
		return nodes
			.map((node) => ({ ...node, children: sortTree(node.children) }))
			.sort((a, b) => {
				if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
	}

	return sortTree(root.children.map(collapse));
}

export function buildPatchString(file: PullFile): string {
	if (!file.patch) return "";
	const source = file.previousFilename ?? file.filename;
	const header = `diff --git a/${source} b/${file.filename}\n--- a/${source}\n+++ b/${file.filename}\n`;
	return header + file.patch;
}

export function encodeFileId(filename: string): string {
	return `diff-${filename.replaceAll("/", "-").replaceAll(".", "-")}`;
}
