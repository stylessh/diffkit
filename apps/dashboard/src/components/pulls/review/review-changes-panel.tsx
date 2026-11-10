import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import type { ReactNode } from "react";
import { SkeletonBox } from "skullet/react";
import type { DiffView } from "./review-diff-toolbar";

function Count({ value }: { value: number | undefined }) {
	return value === undefined ? (
		<SkeletonBox width={14} height={12} radius={4} />
	) : (
		<ViewTabCount>{value}</ViewTabCount>
	);
}

/** The side panel: the changed files or the commits behind them. */
export function ReviewChangesPanel({
	view,
	onViewChange,
	fileCount,
	commitCount,
	files,
	commits,
}: {
	view: DiffView;
	onViewChange: (view: DiffView) => void;
	fileCount: number | undefined;
	commitCount: number | undefined;
	files: ReactNode;
	commits: ReactNode;
}) {
	return (
		<aside aria-label="Changes" className="flex h-full min-h-0 flex-col">
			<ViewTabs label="Changes" className="px-3">
				<ViewTab
					active={view === "files"}
					onClick={() => onViewChange("files")}
				>
					Files
					<Count value={fileCount} />
				</ViewTab>
				<ViewTab
					active={view === "commits"}
					onClick={() => onViewChange("commits")}
				>
					Commits
					<Count value={commitCount} />
				</ViewTab>
			</ViewTabs>
			<div className="min-h-0 flex-1">{view === "files" ? files : commits}</div>
		</aside>
	);
}
