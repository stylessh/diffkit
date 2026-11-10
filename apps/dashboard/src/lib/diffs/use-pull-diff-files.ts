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
import { readGitDiffFiles, splitGitDiff } from "./git-diff-stream";
import { readRawDiff, writeRawDiff } from "./raw-diff-cache";
import {
	recallSettledDiff,
	rememberSettledDiff,
	type SettledDiff,
} from "./settled-diffs";

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

type StreamState = PullDiffFiles | SettledDiff;

const WAITING: StreamState = { phase: "waiting" };

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
function createPublisher(publish: (files: DiffFile[]) => void) {
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
				publish(files.slice());
			}
			if (now - lastYieldAt >= WORK_BUDGET_MS) {
				await yieldToBrowser();
				lastYieldAt = performance.now();
			}
		},
		all: () => files.slice(),
	};
}

async function loadStream(
	scope: GitHubQueryScope,
	input: PullDiffInput,
	revision: string,
	signal: AbortSignal,
	setState: (state: StreamState) => void,
) {
	const publisher = createPublisher((files) => {
		if (!signal.aborted) setState({ phase: "streaming", files });
	});
	const ingest = async (
		texts: Iterable<string> | AsyncIterable<string>,
		keep?: string[],
	) => {
		for await (const text of texts) {
			if (signal.aborted) return;
			keep?.push(text);
			const file = parseGitDiffFile(text, revision);
			if (file) await publisher.add(file);
		}
	};
	const settle = (diff: SettledDiff, rawCharacters: number) => {
		if (signal.aborted) return;
		rememberSettledDiff(revision, diff, rawCharacters);
		setState(diff);
	};

	const cached = await readRawDiff(scope.userId, revision);
	if (cached !== null) {
		await ingest(splitGitDiff(cached));
		settle({ phase: "complete", files: publisher.all() }, cached.length);
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
		settle({ phase: "too-large" }, 0);
		return;
	}
	if (!response.ok || !response.body) {
		throw new Error(`Couldn't load the diff (${response.status})`);
	}
	const texts: string[] = [];
	await ingest(readGitDiffFiles(response.body, signal), texts);
	const raw = texts.join("");
	settle({ phase: "complete", files: publisher.all() }, raw.length);
	if (!signal.aborted) void writeRawDiff(scope.userId, revision, raw);
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
	}>({ revision: "", state: WAITING });
	const settled = headSha ? recallSettledDiff(revision) : undefined;

	useEffect(() => {
		if (!headSha || recallSettledDiff(revision)) return;
		const controller = new AbortController();
		const setState = (state: StreamState) => setStream({ revision, state });
		setState(WAITING);
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
		settled ?? (stream.revision === revision ? stream.state : WAITING);
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
