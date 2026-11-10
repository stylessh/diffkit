import { MOBILE_ACTION_BAR_CLEARANCE } from "@diffkit/ui/components/mobile-action-bar";
import type { ReactNode, Ref } from "react";
import type {
	DiffCodeViewHandle,
	DiffReview,
} from "#/components/diffs/diff-code-view";
import { DiffSkeleton } from "#/components/diffs/diff-skeleton";
import { LazyDiffCodeView } from "#/components/diffs/lazy-diff-code-view";
import type { DiffStyle } from "#/lib/diffs/use-diff-options";
import type { PullDiffFiles } from "#/lib/diffs/use-pull-diff-files";

function Notice({ children }: { children: ReactNode }) {
	return (
		<p className="px-4 py-10 text-center text-[13px] font-[450] text-muted-foreground">
			{children}
		</p>
	);
}

/** The diff itself, in whichever state its files are in. */
export function ReviewDiffPane({
	ref,
	revision,
	diff,
	expectedFileCount,
	diffStyle,
	wrapLines,
	review,
	clearsMobileActionBar,
	onActiveFileChange,
}: {
	ref: Ref<DiffCodeViewHandle>;
	revision: string;
	diff: PullDiffFiles;
	expectedFileCount: number;
	diffStyle: DiffStyle;
	wrapLines: boolean;
	review: DiffReview;
	clearsMobileActionBar: boolean;
	onActiveFileChange: (path: string) => void;
}) {
	switch (diff.phase) {
		case "waiting":
			return <DiffSkeleton />;
		case "error":
			return <Notice>{diff.error.message}</Notice>;
		case "streaming":
		case "complete": {
			if (diff.phase === "complete" && diff.files.length === 0) {
				return <Notice>No files changed in this pull request.</Notice>;
			}
			const isStreaming = diff.phase === "streaming";
			return (
				<LazyDiffCodeView
					ref={ref}
					revision={revision}
					files={diff.files}
					diffStyle={diffStyle}
					wrapLines={wrapLines}
					review={review}
					onActiveFileChange={onActiveFileChange}
					footer={
						isStreaming || clearsMobileActionBar ? (
							<div className={MOBILE_ACTION_BAR_CLEARANCE}>
								{isStreaming ? (
									<p className="px-4 py-3 text-xs font-[450] text-muted-foreground">
										Loaded {diff.files.length} of {expectedFileCount} files…
									</p>
								) : null}
							</div>
						) : undefined
					}
				/>
			);
		}
	}
}
