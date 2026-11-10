import { CheckIcon, ChevronDownIcon, GitBranchIcon } from "@diffkit/icons";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@diffkit/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { cn } from "@diffkit/ui/lib/utils";
import { useMemo, useState } from "react";
import { pillButtonClassName } from "#/components/repo/repo-ui";
import { PickerSkeletonRows } from "#/components/shared/picker-skeleton-rows";
import { sortBranchesByRecency } from "#/lib/branch-sections";
import { isQualifiedRef } from "#/lib/compare-ref";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { RepoBranchListItem } from "#/lib/github.types";

const RECENT_BRANCH_COUNT = 5;

type PickerState = { status: "closed" } | { status: "open"; search: string };

export function CompareRefPicker({
	label,
	value,
	placeholder,
	branches,
	defaultBranch,
	loading,
	truncated,
	onSelect,
}: {
	label: string;
	value: string | null;
	placeholder: string;
	branches: readonly RepoBranchListItem[];
	defaultBranch: string;
	loading: boolean;
	truncated: boolean;
	onSelect: (ref: string) => void;
}) {
	const [state, setState] = useState<PickerState>({ status: "closed" });
	const search = state.status === "open" ? state.search : "";

	const { recent, others } = useMemo(() => {
		const candidates = sortBranchesByRecency(
			branches.filter((branch) => branch.name !== defaultBranch),
		);
		return {
			recent: candidates.slice(0, RECENT_BRANCH_COUNT),
			others: candidates
				.slice(RECENT_BRANCH_COUNT)
				.sort((a, b) => a.name.localeCompare(b.name)),
		};
	}, [branches, defaultBranch]);

	const select = (ref: string) => {
		onSelect(ref);
		setState({ status: "closed" });
	};

	const branchItem = (branch: RepoBranchListItem) => (
		<CommandItem
			key={branch.name}
			value={branch.name}
			onSelect={() => select(branch.name)}
		>
			<CheckIcon
				size={14}
				className={cn(
					"shrink-0",
					branch.name === value ? "opacity-100" : "opacity-0",
				)}
			/>
			<span className="truncate font-mono text-xs">{branch.name}</span>
			{branch.commit?.date ? (
				<span className="ml-auto shrink-0 text-xs text-muted-foreground">
					{formatRelativeTime(branch.commit.date, undefined, { compact: true })}
				</span>
			) : null}
		</CommandItem>
	);

	return (
		<Popover
			open={state.status === "open"}
			onOpenChange={(next) =>
				setState(next ? { status: "open", search: "" } : { status: "closed" })
			}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={value ? `${label}: ${value}` : `Choose ${label}`}
					className={cn(pillButtonClassName, "max-w-[260px]")}
				>
					<GitBranchIcon size={14} strokeWidth={2} />
					<span
						className={cn(
							"min-w-0 truncate font-mono font-[450]",
							!value && "font-sans text-muted-foreground",
						)}
					>
						{value ?? placeholder}
					</span>
					<ChevronDownIcon
						size={12}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="start">
				<Command>
					<CommandInput
						value={search}
						onValueChange={(next) => setState({ status: "open", search: next })}
						placeholder="Find a branch or type owner:branch…"
					/>
					<CommandList>
						{loading ? null : <CommandEmpty>No branches found.</CommandEmpty>}
						{isQualifiedRef(search) ? (
							<CommandItem
								forceMount
								value={`qualified:${search.trim()}`}
								onSelect={() => select(search.trim())}
							>
								<GitBranchIcon size={14} />
								<span className="truncate font-mono text-xs">
									{search.trim()}
								</span>
								<span className="ml-auto shrink-0 text-xs text-muted-foreground">
									fork branch
								</span>
							</CommandItem>
						) : null}
						<CommandGroup heading="Default">
							{branchItem({
								name: defaultBranch,
								commit: null,
								pullRequest: null,
							})}
						</CommandGroup>
						{recent.length > 0 ? (
							<CommandGroup heading="Recent">
								{recent.map(branchItem)}
							</CommandGroup>
						) : null}
						{others.length > 0 ? (
							<CommandGroup heading="Branches">
								{others.map(branchItem)}
							</CommandGroup>
						) : null}
						{loading ? <PickerSkeletonRows label="Loading branches" /> : null}
					</CommandList>
				</Command>
				{truncated ? (
					<p className="border-t-[0.5px] border-popover-border px-3 py-2 text-xs text-muted-foreground">
						Showing the first {branches.length} branches. Type owner:branch to
						compare with a fork.
					</p>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
