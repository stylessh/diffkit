import type { PullFile } from "#/lib/github.types";

export function buildPatchString(file: PullFile): string {
	if (!file.patch) return "";
	const source = file.previousFilename ?? file.filename;
	const header = `diff --git a/${source} b/${file.filename}\n--- a/${source}\n+++ b/${file.filename}\n`;
	return header + file.patch;
}

export function encodeFileId(filename: string): string {
	return `diff-${filename.replaceAll("/", "-").replaceAll(".", "-")}`;
}
