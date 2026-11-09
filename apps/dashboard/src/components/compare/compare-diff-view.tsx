import { cn } from "@diffkit/ui/lib/utils";
import { Suspense, useMemo, useState } from "react";
import { LazyDiffFileList } from "#/components/diffs/lazy-diff-code-view";
import {
	DiffCommitList,
	type DiffStyle,
	DiffToolbar,
	type DiffView,
} from "#/components/pulls/review/review-diff-toolbar";
import { pullFilesToDiffFiles } from "#/lib/diffs/diff-files";
import type { PullCommit, PullFile } from "#/lib/github.types";

export function CompareDiffView({
	commits,
	files,
	filesTruncated = false,
	owner,
	repo,
}: {
	commits: PullCommit[];
	files: PullFile[];
	filesTruncated?: boolean;
	owner: string;
	repo: string;
}) {
	const [diffStyle, setDiffStyle] = useState<DiffStyle>("split");
	const [view, setView] = useState<DiffView>("files");
	const [wrapLines, setWrapLines] = useState(false);
	const revision = `${owner}/${repo}:compare:${commits.at(-1)?.sha ?? ""}`;
	const diffFiles = useMemo(
		() => pullFilesToDiffFiles(files, revision),
		[files, revision],
	);

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<DiffToolbar
				view={view}
				onViewChange={setView}
				fileCount={files.length}
				commitCount={commits.length}
				diffStyle={diffStyle}
				onDiffStyleChange={setDiffStyle}
				wrapLines={wrapLines}
				onWrapLinesChange={setWrapLines}
			/>
			{view === "commits" ? (
				<DiffCommitList commits={commits} owner={owner} repo={repo} />
			) : null}
			<div
				className={cn("flex flex-col gap-2", view === "commits" && "hidden")}
			>
				{filesTruncated ? (
					<p className="rounded-lg bg-pill-warning px-4 py-3 text-xs font-[450] text-pill-warning-text">
						This comparison includes more than {files.length} files; GitHub only
						returns the first {files.length}. Push fewer changes or open the PR
						to view the full set.
					</p>
				) : null}
				{files.length === 0 ? (
					<p className="px-4 py-10 text-center text-[13px] font-[450] text-muted-foreground">
						No files changed.
					</p>
				) : (
					<Suspense fallback={null}>
						<LazyDiffFileList
							files={diffFiles}
							diffStyle={diffStyle}
							wrapLines={wrapLines}
						/>
					</Suspense>
				)}
			</div>
		</div>
	);
}
