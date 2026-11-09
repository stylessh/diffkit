import type { PatchDiffProps } from "@pierre/diffs/react";
import { type ComponentType, lazy } from "react";
import type { PullReviewComment } from "#/lib/github.types";
import type { DiffCodeViewProps } from "./diff-code-view";
import type { DiffFileListProps } from "./diff-file-list";

type CodeViewProps = DiffCodeViewProps & { revision: string };

const loadCodeView = (): Promise<{ default: ComponentType<CodeViewProps> }> =>
	import.meta.env.SSR
		? Promise.resolve({ default: () => null })
		: import("./diff-code-view").then((module) => ({
				default: module.DiffCodeView,
			}));

const loadFileList = (): Promise<{
	default: ComponentType<DiffFileListProps>;
}> =>
	import.meta.env.SSR
		? Promise.resolve({ default: () => null })
		: import("./diff-file-list").then((module) => ({
				default: module.DiffFileList,
			}));

let pendingCodeView: ReturnType<typeof loadCodeView> | undefined;

/** Starts fetching the viewer, its highlighter and worker code ahead of render. */
export function preloadDiffCodeView() {
	pendingCodeView ??= loadCodeView();
	return pendingCodeView;
}

export const LazyDiffCodeView = lazy(preloadDiffCodeView);
export const LazyDiffFileList = lazy(loadFileList);

const loadPatch = (): Promise<{
	default: ComponentType<PatchDiffProps<PullReviewComment, undefined>>;
}> =>
	import.meta.env.SSR
		? Promise.resolve({ default: () => null })
		: import("./diff-patch").then((module) => ({
				default: module.DiffPatch<PullReviewComment>,
			}));

export const LazyReviewCommentPatch = lazy(loadPatch);
