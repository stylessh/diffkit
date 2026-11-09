import {
	type ChangeTypes,
	type FileDiffMetadata,
	processFile,
} from "@pierre/diffs";
import type { PullFile } from "#/lib/github.types";

export type DiffFileStatus = "added" | "removed" | "modified" | "renamed";

/** One file of a diff as the viewer and the file header see it. */
export type DiffFile = {
	path: string;
	previousPath: string | null;
	status: DiffFileStatus;
	additions: number;
	deletions: number;
	fileDiff: FileDiffMetadata;
};

const STATUS_BY_CHANGE_TYPE: Record<ChangeTypes, DiffFileStatus> = {
	new: "added",
	deleted: "removed",
	change: "modified",
	"rename-pure": "renamed",
	"rename-changed": "renamed",
};

export function toDiffFile(fileDiff: FileDiffMetadata): DiffFile {
	let additions = 0;
	let deletions = 0;
	for (const hunk of fileDiff.hunks) {
		additions += hunk.additionLines;
		deletions += hunk.deletionLines;
	}
	return {
		path: fileDiff.name,
		previousPath:
			fileDiff.prevName && fileDiff.prevName !== fileDiff.name
				? fileDiff.prevName
				: null,
		status: STATUS_BY_CHANGE_TYPE[fileDiff.type],
		additions,
		deletions,
		fileDiff,
	};
}

export function parseGitDiffFile(
	text: string,
	cacheKeyPrefix: string,
): DiffFile | null {
	const fileDiff = processFile(text, { isGitDiff: true });
	if (!fileDiff) return null;
	fileDiff.cacheKey = `${cacheKeyPrefix}:${fileDiff.name}`;
	return toDiffFile(fileDiff);
}

function gitHeaderForPullFile(file: PullFile) {
	const previous = file.previousFilename ?? file.filename;
	const lines = [`diff --git a/${previous} b/${file.filename}`];
	if (file.status === "added") lines.push("new file mode 100644");
	if (file.status === "removed") lines.push("deleted file mode 100644");
	if (previous !== file.filename) {
		lines.push(`rename from ${previous}`, `rename to ${file.filename}`);
	}
	if (file.patch) {
		lines.push(
			file.status === "added" ? "--- /dev/null" : `--- a/${previous}`,
			file.status === "removed" ? "+++ /dev/null" : `+++ b/${file.filename}`,
		);
	}
	return `${lines.join("\n")}\n`;
}

/** REST `pulls/files` entries carry hunks without the git header; rebuild it so both sources parse the same way. */
export function pullFileToDiffFile(
	file: PullFile,
	cacheKeyPrefix: string,
): DiffFile | null {
	const text = gitHeaderForPullFile(file) + (file.patch ?? "");
	const parsed = parseGitDiffFile(text, cacheKeyPrefix);
	if (!parsed) return null;
	return {
		...parsed,
		additions: file.additions,
		deletions: file.deletions,
	};
}

/** Already-fetched REST files (commits, comparisons) as viewer files, parsed once per array. */
export function pullFilesToDiffFiles(
	files: readonly PullFile[],
	cacheKeyPrefix: string,
): DiffFile[] {
	const parsed: DiffFile[] = [];
	for (const file of files) {
		const diffFile = pullFileToDiffFile(file, cacheKeyPrefix);
		if (diffFile) parsed.push(diffFile);
	}
	return parsed;
}
