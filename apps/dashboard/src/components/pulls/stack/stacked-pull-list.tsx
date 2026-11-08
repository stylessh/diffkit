import { GitBranchIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useMemo } from "react";
import { PullRequestRow } from "#/components/pulls/pull-request-row";
import type { GitHubQueryScope } from "#/lib/github.query";
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

/**
 * Repo PR list rows with an optional "group stacks" mode: PRs that are stacked
 * on each other render together, parent first, indented by depth. Stacks are
 * derived from `allPulls` (everything loaded, open PRs only) so filters hiding
 * a member do not break the chain.
 */
export function StackedPullList({
	pulls,
	allPulls,
	scope,
}: {
	/** Rows to show, already filtered and sorted. */
	pulls: PullSummary[];
	/** Everything loaded for the repo, used to derive stacks. */
	allPulls: PullSummary[];
	scope: GitHubQueryScope;
}) {
	const [groupStacks, setGroupStacks] = useLocalStorageState(
		GROUP_STACKS_STORAGE_KEY,
		{
			defaultValue: true,
			validate: isBoolean,
			parse: (raw) => raw === "true",
		},
	);

	const repoFullName = pulls[0]?.repository.fullName ?? "";
	const index = useMemo(
		() =>
			repoFullName ? buildPullStackIndex(allPulls, { repoFullName }) : null,
		[allPulls, repoFullName],
	);
	const hasStacks = (index?.stacks.length ?? 0) > 0;
	const items = useMemo(
		() =>
			hasStacks && groupStacks && index
				? groupPullsByStack(pulls, index)
				: null,
		[hasStacks, groupStacks, index, pulls],
	);

	return (
		<div className="flex flex-col gap-1">
			{hasStacks ? (
				<label className="flex w-fit cursor-pointer items-center gap-2 self-end px-3 py-1 text-xs text-muted-foreground">
					<input
						type="checkbox"
						checked={groupStacks}
						onChange={(event) => setGroupStacks(event.target.checked)}
					/>
					Group stacked PRs
				</label>
			) : null}

			{items
				? items.map((item) =>
						item.kind === "pull" ? (
							<div key={item.pull.id} style={rowVisibilityStyle}>
								<PullRequestRow pr={item.pull} scope={scope} />
							</div>
						) : (
							<section
								key={`stack-${item.rootNumber}`}
								aria-label={`Stack of ${item.size} pull requests`}
								className="my-1 rounded-xl border-[0.5px] bg-surface-1/40 py-1"
							>
								<p className="flex items-center gap-1.5 px-3 pb-0.5 pt-1.5 text-xs font-medium text-muted-foreground">
									<GitBranchIcon size={12} strokeWidth={2} />
									<span>
										Stack · <span className="tabular-nums">{item.size}</span>{" "}
										PRs
									</span>
								</p>
								{item.entries.map(({ pull, depth }) => (
									<div
										key={pull.id}
										style={{
											...rowVisibilityStyle,
											marginLeft: depth * 16,
										}}
										className={cn(
											depth > 0 && "border-l-[0.5px] border-border",
										)}
									>
										<PullRequestRow pr={pull} scope={scope} />
									</div>
								))}
							</section>
						),
					)
				: pulls.map((pull) => (
						<div key={pull.id} style={rowVisibilityStyle}>
							<PullRequestRow pr={pull} scope={scope} />
						</div>
					))}
		</div>
	);
}
