import { cn } from "@diffkit/ui/lib/utils";
import { Skeleton } from "skullet/react";
import { SkeletonSample } from "#/components/shared/skeleton-sample";
import { DIFF_LINE_HEIGHT } from "#/lib/diffs/diff-surface-css";
import { DiffFileHeader } from "./diff-file-header";
import { SAMPLE_DIFF_FILES, type SampleDiffFile } from "./diff-samples";

const noop = () => undefined;

function CodeLines({ lines }: { lines: readonly string[] }) {
	return (
		<div className="font-mono text-[12px]">
			{lines.map((line, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: placeholder lines never reorder
					key={index}
					className="flex items-center whitespace-pre"
					style={{ height: DIFF_LINE_HEIGHT }}
				>
					<span className="w-[52px] shrink-0 pr-3 text-right tabular-nums">
						{index + 1}
					</span>
					<span>{line}</span>
				</div>
			))}
		</div>
	);
}

function SampleFile({
	file,
	layout,
}: {
	file: SampleDiffFile;
	layout: DiffSkeletonLayout;
}) {
	return (
		<section
			className={cn(
				layout === "cards" &&
					"overflow-clip rounded-lg border-[0.5px] border-card-border bg-main",
			)}
		>
			<DiffFileHeader
				file={file}
				isCollapsed={false}
				onToggleCollapse={noop}
				onViewedChange={noop}
			/>
			<div className="py-1">
				<CodeLines lines={file.lines} />
			</div>
		</section>
	);
}

type DiffSkeletonLayout = "pane" | "cards";

/**
 * Stands in for a diff that has not arrived: real file headers over bars for
 * the code lines. `pane` fills a scroller the way the code view does; `cards`
 * stacks in page flow like the compare page's file list.
 */
export function DiffSkeleton({
	layout = "pane",
}: {
	layout?: DiffSkeletonLayout;
}) {
	return (
		<Skeleton
			loading
			label="Loading diff"
			className={cn(layout === "pane" && "h-full overflow-hidden")}
		>
			<SkeletonSample>
				<div className={cn(layout === "cards" && "flex flex-col gap-2")}>
					{SAMPLE_DIFF_FILES.map((file) => (
						<SampleFile key={file.path} file={file} layout={layout} />
					))}
				</div>
			</SkeletonSample>
		</Skeleton>
	);
}

function patchCodeLines(patch: string) {
	const lines = patch.split("\n");
	const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
	return lines
		.slice(firstHunk + 1)
		.filter((line) => line !== "" && !line.startsWith("@@"))
		.map((line) => line.slice(1));
}

/** A single patch's worth of bars, one per line the patch will render. */
export function DiffPatchSkeleton({ patch }: { patch: string }) {
	return (
		<Skeleton loading label="Loading diff">
			<CodeLines lines={patchCodeLines(patch)} />
		</Skeleton>
	);
}
