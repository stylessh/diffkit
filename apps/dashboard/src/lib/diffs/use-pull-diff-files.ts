import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";
import { githubPullFilesInfiniteQueryOptions } from "#/lib/github.query";
import type { PullFile } from "#/lib/github.types";
import {
	type DiffFile,
	parseGitDiffFile,
	pullFileToDiffFile,
} from "./diff-files";
import { readGitDiffFiles } from "./git-diff-stream";
import { readRawDiff, writeRawDiff } from "./raw-diff-cache";

const WORK_BUDGET_MS = 8;
const FIRST_PUBLISH_FILES = 12;
const FIRST_PUBLISH_MS = 150;
const PUBLISH_FILES = 25;
const PUBLISH_MS = 100;

export type PullDiffFiles =
	| { phase: "waiting" }
	| { phase: "streaming"; files: readonly DiffFile[] }
	| { phase: "complete"; files: readonly DiffFile[] }
	| { phase: "error"; error: Error };

type StreamState = PullDiffFiles | { phase: "too-large" };

type PullDiffInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	headSha: string | undefined;
	baseRefName: string | undefined;
};

function yieldToBrowser(): Promise<void> {
	const scheduler = (
		globalThis as { scheduler?: { yield?: () => Promise<void> } }
	).scheduler;
	if (scheduler?.yield) return scheduler.yield();
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Feeds parsed files out in batches while staying inside a frame budget, so a
 * multi-megabyte diff never blocks scrolling while it streams in.
 */
function createPublisher(publish: (files: DiffFile[], done: boolean) => void) {
	const files: DiffFile[] = [];
	let published = 0;
	let lastPublishAt = performance.now();
	let lastYieldAt = lastPublishAt;

	return {
		async add(file: DiffFile) {
			files.push(file);
			const now = performance.now();
			const pending = files.length - published;
			const [batch, interval] =
				published === 0
					? [FIRST_PUBLISH_FILES, FIRST_PUBLISH_MS]
					: [PUBLISH_FILES, PUBLISH_MS];
			if (pending >= batch || now - lastPublishAt >= interval) {
				published = files.length;
				lastPublishAt = now;
				publish(files.slice(), false);
			}
			if (now - lastYieldAt >= WORK_BUDGET_MS) {
				await yieldToBrowser();
				lastYieldAt = performance.now();
			}
		},
		finish() {
			publish(files.slice(), true);
		},
	};
}

async function* splitCachedDiff(text: string): AsyncGenerator<string> {
	const stream = new Blob([text]).stream();
	yield* readGitDiffFiles(stream, new AbortController().signal);
}

async function loadStream(
	scope: GitHubQueryScope,
	input: PullDiffInput,
	revision: string,
	signal: AbortSignal,
	setState: (state: StreamState) => void,
) {
	const publisher = createPublisher((files, done) => {
		if (signal.aborted) return;
		setState({ phase: done ? "complete" : "streaming", files });
	});
	const ingest = async (texts: AsyncIterable<string>, keep?: string[]) => {
		for await (const text of texts) {
			if (signal.aborted) return;
			keep?.push(text);
			const file = parseGitDiffFile(text, revision);
			if (file) await publisher.add(file);
		}
	};

	const cached = await readRawDiff(scope.userId, revision);
	if (cached !== null) {
		await ingest(splitCachedDiff(cached));
		publisher.finish();
		return;
	}

	const params = new URLSearchParams({
		owner: input.owner,
		repo: input.repo,
		number: String(input.pullNumber),
	});
	const response = await fetch(`/api/pulls/diff?${params}`, {
		signal,
		cache: "no-store",
	});
	if (response.status === 413) {
		setState({ phase: "too-large" });
		return;
	}
	if (!response.ok || !response.body) {
		throw new Error(`Couldn't load the diff (${response.status})`);
	}
	const texts: string[] = [];
	await ingest(readGitDiffFiles(response.body, signal), texts);
	if (signal.aborted) return;
	publisher.finish();
	void writeRawDiff(scope.userId, revision, texts.join(""));
}

const pagedFileCache = new WeakMap<PullFile, DiffFile | null>();

function toPagedDiffFile(file: PullFile, revision: string) {
	let parsed = pagedFileCache.get(file);
	if (parsed === undefined) {
		parsed = pullFileToDiffFile(file, revision);
		pagedFileCache.set(file, parsed);
	}
	return parsed;
}

/**
 * The files of a pull request diff: streamed from the raw `.diff` (or the
 * IndexedDB copy of it), falling back to the paginated `pulls/files` API when
 * GitHub refuses to produce a diff that large.
 */
export function usePullDiffFiles(
	scope: GitHubQueryScope,
	input: PullDiffInput,
): { revision: string; files: PullDiffFiles } {
	const { owner, repo, pullNumber, headSha, baseRefName } = input;
	const revision = `${owner}/${repo}#${pullNumber}@${headSha}:${baseRefName}`;
	const [stream, setStream] = useState<{
		revision: string;
		state: StreamState;
	}>({ revision: "", state: { phase: "waiting" } });

	useEffect(() => {
		if (!headSha) return;
		const controller = new AbortController();
		const setState = (state: StreamState) => setStream({ revision, state });
		setState({ phase: "waiting" });
		loadStream(
			scope,
			{ owner, repo, pullNumber, headSha, baseRefName },
			revision,
			controller.signal,
			setState,
		).catch((error: unknown) => {
			if (controller.signal.aborted) return;
			setState({
				phase: "error",
				error: error instanceof Error ? error : new Error(String(error)),
			});
		});
		return () => controller.abort();
	}, [scope, owner, repo, pullNumber, headSha, baseRefName, revision]);

	const streamState: StreamState =
		stream.revision === revision ? stream.state : { phase: "waiting" };
	const usePages = streamState.phase === "too-large";

	const pages = useInfiniteQuery({
		...githubPullFilesInfiniteQueryOptions(scope, { owner, repo, pullNumber }),
		enabled: usePages,
	});
	const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
	useEffect(() => {
		if (usePages && hasNextPage && !isFetchingNextPage) void fetchNextPage();
	}, [usePages, hasNextPage, isFetchingNextPage, fetchNextPage]);

	const pagedFiles = useMemo(() => {
		if (!pages.data) return null;
		const files: DiffFile[] = [];
		for (const page of pages.data.pages) {
			for (const file of page.files) {
				const parsed = toPagedDiffFile(file, revision);
				if (parsed) files.push(parsed);
			}
		}
		return files;
	}, [pages.data, revision]);

	if (streamState.phase !== "too-large") {
		return { revision, files: streamState };
	}
	if (pages.error)
		return { revision, files: { phase: "error", error: pages.error } };
	if (!pagedFiles) return { revision, files: { phase: "waiting" } };
	return {
		revision,
		files: {
			phase: hasNextPage ? "streaming" : "complete",
			files: pagedFiles,
		},
	};
}
