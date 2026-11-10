import type { PatchDiffProps } from "@pierre/diffs/react";
import { type ComponentType, lazy, Suspense } from "react";
import type { PullReviewComment } from "#/lib/github.types";
import type { DiffCodeViewProps } from "./diff-code-view";
import type { DiffFileListProps } from "./diff-file-list";
import { DiffPatchSkeleton, DiffSkeleton } from "./diff-skeleton";

type CodeViewProps = DiffCodeViewProps & { revision: string };
type PatchProps = PatchDiffProps<PullReviewComment, undefined>;

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

const loadPatch = (): Promise<{ default: ComponentType<PatchProps> }> =>
	import.meta.env.SSR
		? Promise.resolve({ default: () => null })
		: import("./diff-patch").then((module) => ({
				default: module.DiffPatch<PullReviewComment>,
			}));

let pendingCodeView: ReturnType<typeof loadCodeView> | undefined;

/**
 * Starts fetching the viewer ahead of render, and brings up its highlighter
 * and workers so they are ready by the time the first file arrives.
 */
export function preloadDiffCodeView() {
	if (!pendingCodeView) {
		pendingCodeView = loadCodeView();
		if (!import.meta.env.SSR) {
			void import("#/lib/diffs/diffs-runtime").then((module) =>
				module.getDiffsRuntime(),
			);
		}
	}
	return pendingCodeView;
}

const CodeView = lazy(preloadDiffCodeView);
const FileList = lazy(loadFileList);
const Patch = lazy(loadPatch);

export function LazyDiffCodeView(props: CodeViewProps) {
	return (
		<Suspense fallback={<DiffSkeleton />}>
			<CodeView {...props} />
		</Suspense>
	);
}

export function LazyDiffFileList(props: DiffFileListProps) {
	return (
		<Suspense fallback={<DiffSkeleton layout="cards" />}>
			<FileList {...props} />
		</Suspense>
	);
}

export function LazyReviewCommentPatch(props: PatchProps) {
	return (
		<Suspense fallback={<DiffPatchSkeleton patch={props.patch} />}>
			<Patch {...props} />
		</Suspense>
	);
}
