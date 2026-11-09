import { GitPullRequestIcon, LayersIcon } from "@diffkit/icons";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useMemo } from "react";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import { ListGroup } from "#/components/shared/list-page";
import type { PullSummary } from "#/lib/github.types";
import { buildPullStackIndex, groupPullsByStack } from "#/lib/pull-stack";
import { useLocalStorageState } from "#/lib/use-local-storage-state";

const GROUP_STACKS_STORAGE_KEY = "diffkit:pulls:group-stacks";

const rowVisibilityStyle = {
	contentVisibility: "auto",
	containIntrinsicSize: "auto 52px",
} as const;

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

/** Whether a repo's PR list groups stacked PRs together; remembered per browser. */
export function useGroupStacks() {
	return useLocalStorageState(GROUP_STACKS_STORAGE_KEY, {
		defaultValue: true,
		validate: isBoolean,
		parse: (raw) => raw === "true",
	});
}

/** The tab-row toggle for grouping stacked PRs. */
export function GroupStacksToggle({
	value,
	onChange,
}: {
	value: boolean;
	onChange: (next: boolean) => void;
}) {
	const label = value ? "Ungroup stacked PRs" : "Group stacked PRs";
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<PageIconButton
					raised
					aria-label="Group stacked PRs"
					aria-pressed={value}
					onClick={() => onChange(!value)}
					className="aria-pressed:text-foreground"
				>
					<LayersIcon size={14} strokeWidth={2} />
				</PageIconButton>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

/** A stack is named after its base PR, so two stacks read apart at a glance. */
function stackTitle(stack: {
	rootNumber: number;
	entries: { pull: PullSummary }[];
}) {
	const root =
		stack.entries.find((entry) => entry.pull.number === stack.rootNumber)
			?.pull ?? stack.entries[0]?.pull;
	return root
		? `#${root.number} ${root.title}`
		: `Stack from #${stack.rootNumber}`;
}

/**
 * Repo PR list rows, with stacked PRs optionally gathered into a group each,
 * base first. Stacks are derived from `allPulls` (everything loaded, open PRs
 * only) so filters hiding a member do not break the chain.
 */
export function StackedPullList({
	pulls,
	allPulls,
	groupStacks,
}: {
	/** Rows to show, already filtered and sorted. */
	pulls: PullSummary[];
	/** Everything loaded for the repo, used to derive stacks. */
	allPulls: PullSummary[];
	groupStacks: boolean;
}) {
	const repoFullName = pulls[0]?.repository.fullName ?? "";
	const index = useMemo(
		() =>
			repoFullName ? buildPullStackIndex(allPulls, { repoFullName }) : null,
		[allPulls, repoFullName],
	);
	const items = useMemo(
		() =>
			groupStacks && index && index.stacks.length > 0
				? groupPullsByStack(pulls, index)
				: null,
		[groupStacks, index, pulls],
	);

	if (!items) {
		return (
			<div className="flex flex-col">
				{pulls.map((pull) => (
					<div key={pull.id} style={rowVisibilityStyle}>
						<PullRequestRow pr={pull} showRepository={false} />
					</div>
				))}
			</div>
		);
	}

	// Each stack is its own group; every PR outside a stack falls into one group after them.
	const stacks = items.filter((item) => item.kind === "stack");
	const loose = items.flatMap((item) =>
		item.kind === "pull" ? [item.pull] : [],
	);

	return (
		<div className="flex flex-col gap-1">
			{stacks.map((stack) => (
				<ListGroup
					key={`stack-${stack.rootNumber}`}
					icon={LayersIcon}
					title={stackTitle(stack)}
					label={`Stack of ${stack.size} pull requests from #${stack.rootNumber}`}
					count={stack.size}
				>
					{stack.entries.map(({ pull }) => (
						<div key={pull.id} style={rowVisibilityStyle}>
							<PullRequestRow pr={pull} showRepository={false} />
						</div>
					))}
				</ListGroup>
			))}
			<ListGroup
				icon={GitPullRequestIcon}
				title="Not stacked"
				count={loose.length}
			>
				{loose.map((pull) => (
					<div key={pull.id} style={rowVisibilityStyle}>
						<PullRequestRow pr={pull} showRepository={false} />
					</div>
				))}
			</ListGroup>
		</div>
	);
}
