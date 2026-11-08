import { GitCompareIcon } from "@diffkit/icons";
import { LineCounts } from "@diffkit/ui/components/detail-layout";
import type { CompareDetail } from "#/lib/github.functions";
import type { RepoBranchListItem } from "#/lib/github.types";
import { CompareRefPicker } from "./compare-ref-picker";

export type CompareBranches = {
	items: readonly RepoBranchListItem[];
	loading: boolean;
	truncated: boolean;
};

function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function CompareSummary({ compare }: { compare: CompareDetail }) {
	const additions = compare.files.reduce((sum, f) => sum + f.additions, 0);
	const deletions = compare.files.reduce((sum, f) => sum + f.deletions, 0);
	const parts = [
		compare.aheadBy > 0 ? `${plural(compare.aheadBy, "commit")} ahead` : null,
		compare.behindBy > 0
			? `${plural(compare.behindBy, "commit")} behind`
			: null,
	].filter((part) => part !== null);

	return (
		<span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-[450] text-muted-foreground tabular-nums md:ml-auto">
			<span>
				{compare.status === "identical"
					? "Branches are identical"
					: parts.join(" · ")}
			</span>
			<LineCounts additions={additions} deletions={deletions} />
		</span>
	);
}

export function CompareBranchBar({
	base,
	head,
	defaultBranch,
	branches,
	compare,
	onBaseChange,
	onHeadChange,
}: {
	base: string;
	head: string | null;
	defaultBranch: string;
	branches: CompareBranches;
	compare: CompareDetail | null;
	onBaseChange: (ref: string) => void;
	onHeadChange: (ref: string) => void;
}) {
	const pickerProps = {
		branches: branches.items,
		defaultBranch,
		loading: branches.loading,
		truncated: branches.truncated,
	};

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-0 px-3 py-2 shadow-card">
			<GitCompareIcon
				size={14}
				strokeWidth={2}
				className="shrink-0 text-muted-foreground"
			/>
			<span className="text-xs font-[450] text-muted-foreground">base</span>
			<CompareRefPicker
				{...pickerProps}
				label="Base branch"
				value={base}
				placeholder="Choose base"
				onSelect={onBaseChange}
			/>
			<span aria-hidden className="text-icon-faint">
				←
			</span>
			<span className="text-xs font-[450] text-muted-foreground">compare</span>
			<CompareRefPicker
				{...pickerProps}
				label="Compare branch"
				value={head}
				placeholder="Choose a branch"
				onSelect={onHeadChange}
			/>
			{compare ? <CompareSummary compare={compare} /> : null}
		</div>
	);
}
