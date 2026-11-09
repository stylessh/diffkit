const FILE_BOUNDARY = "\ndiff --git ";

/**
 * Splits a unified git diff into one text per file. A file is only emitted once
 * the next `diff --git` header arrives, so every yielded text is complete.
 */
export function createGitDiffSplitter() {
	let buffer = "";
	let searchFrom = 0;

	function take(): string[] {
		const files: string[] = [];
		for (;;) {
			const boundary = buffer.indexOf(FILE_BOUNDARY, Math.max(1, searchFrom));
			if (boundary === -1) {
				searchFrom = Math.max(1, buffer.length - FILE_BOUNDARY.length + 1);
				return files;
			}
			const file = buffer.slice(0, boundary + 1);
			buffer = buffer.slice(boundary + 1);
			searchFrom = 1;
			if (file.trim() !== "") files.push(file);
		}
	}

	return {
		push(chunk: string): string[] {
			buffer += chunk;
			return take();
		},
		finish(): string[] {
			const files = take();
			if (buffer.trim() !== "") files.push(buffer);
			buffer = "";
			return files;
		},
	};
}

export async function* readGitDiffFiles(
	body: ReadableStream<Uint8Array>,
	signal: AbortSignal,
): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	const splitter = createGitDiffSplitter();
	try {
		for (;;) {
			if (signal.aborted) return;
			const { done, value } = await reader.read();
			if (done) break;
			yield* splitter.push(decoder.decode(value, { stream: true }));
		}
		yield* splitter.push(decoder.decode());
		yield* splitter.finish();
	} finally {
		reader.releaseLock();
	}
}
