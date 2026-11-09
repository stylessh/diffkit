import { StatePill } from "@diffkit/ui/components/state-pill";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { PullSummary } from "#/lib/github.types";
import { getPrStateConfig } from "#/lib/pr-state";
import type { PullStackEntry } from "#/lib/pull-stack";

/** Where a row's guide line runs: to the row below, from the row above, both, or neither. */
type RailReach = "down" | "both" | "up" | "none";

function Rail({ reach, dot }: { reach: RailReach; dot: React.ReactNode }) {
	return (
		<span aria-hidden className="relative flex w-4 shrink-0 justify-center">
			<span
				className={cn(
					"absolute left-1/2 w-px -translate-x-1/2 bg-activity-line/35",
					reach === "down" && "top-1/2 bottom-0",
					reach === "both" && "inset-y-0",
					reach === "up" && "top-0 bottom-1/2",
				)}
			/>
			<span className="relative flex items-center">{dot}</span>
		</span>
	);
}

function railReach(
	index: number,
	count: number,
	endsOnTarget: boolean,
): RailReach {
	const continuesBelow = index < count - 1 || endsOnTarget;
	if (index === 0) return continuesBelow ? "down" : "none";
	return continuesBelow ? "both" : "up";
}

/**
 * The stack top down, as it lands: the newest PR first, each a dot on one
 * guide line, which ends on the branch the stack merges into. The current PR
 * is marked; every other entry links to its PR page.
 */
export function PullStackList({
	entries,
	currentNumber,
	owner,
	repo,
	className,
}: {
	entries: PullStackEntry<PullSummary>[];
	currentNumber: number;
	owner: string;
	repo: string;
	className?: string;
}) {
	const topDown = [...entries].reverse();
	const target = entries[0]?.pull.baseRefName?.trim();

	return (
		<ol className={cn("flex flex-col text-[13px]", className)}>
			{topDown.map(({ pull }, index) => {
				const isCurrent = pull.number === currentNumber;
				const state = getPrStateConfig(pull);
				const Icon = state.icon;
				return (
					<li key={pull.number} className="flex gap-1">
						<Rail
							reach={railReach(index, topDown.length, Boolean(target))}
							dot={
								<span
									className={cn(
										"size-[7px] rounded-full",
										isCurrent
											? "bg-muted-foreground ring-[3px] ring-muted-foreground/25"
											: "bg-icon-faint",
									)}
								/>
							}
						/>
						<Link
							to="/$owner/$repo/pull/$pullId"
							params={{ owner, repo, pullId: String(pull.number) }}
							preload={false}
							aria-current={isCurrent ? "page" : undefined}
							className={cn(
								"my-0.5 flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 leading-5 transition-colors",
								isCurrent
									? "bg-surface-2 font-medium text-foreground"
									: "text-muted-foreground hover:bg-ghost-hover hover:text-foreground",
							)}
						>
							<Icon
								size={13}
								strokeWidth={2}
								className={cn("shrink-0", state.color)}
							/>
							<span className="shrink-0 tabular-nums">#{pull.number}</span>
							<span className="min-w-0 truncate">{pull.title}</span>
							<StatePill
								tone={state.tone}
								className="ml-auto h-4 shrink-0 px-1.5 text-[11px]"
							>
								{state.label}
							</StatePill>
						</Link>
					</li>
				);
			})}
			{target ? (
				<li className="flex gap-1">
					<Rail
						reach="up"
						dot={
							<span className="size-[9px] rounded-full border-[1.5px] border-icon-faint bg-card" />
						}
					/>
					<span className="my-0.5 flex items-center px-2 py-1.5 leading-5">
						<span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-header">
							{target}
						</span>
					</span>
				</li>
			) : null}
		</ol>
	);
}
