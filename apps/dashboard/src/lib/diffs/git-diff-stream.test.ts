import { describe, expect, it } from "vitest";
import { createGitDiffSplitter } from "./git-diff-stream";

const fileA =
	"diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+b\n";
const fileB =
	"diff --git a/b.ts b/b.ts\nnew file mode 100644\n--- /dev/null\n+++ b/b.ts\n@@ -0,0 +1 @@\n+diff --git inside content\n";
const fileC =
	"diff --git a/c.png b/c.png\nBinary files a/c.png and b/c.png differ\n";

describe("createGitDiffSplitter", () => {
	it("emits each file whole however the stream is chunked", () => {
		const diff = fileA + fileB + fileC;
		for (const chunkSize of [1, 3, 7, 13, diff.length]) {
			const splitter = createGitDiffSplitter();
			const files: string[] = [];
			for (let index = 0; index < diff.length; index += chunkSize) {
				files.push(...splitter.push(diff.slice(index, index + chunkSize)));
			}
			files.push(...splitter.finish());
			expect(files).toEqual([fileA, fileB, fileC]);
		}
	});
});
