import { ChevronRightIcon, LayersIcon } from "@diffkit/icons";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@diffkit/ui/components/collapsible";
import { cn } from "@diffkit/ui/lib/utils";
import { useState } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { PullDetail } from "#/lib/github.types";
import { PullStackList } from "./pull-stack-list";
import { usePullStack } from "./use-pull-stack";

/**
 * The stack this PR is part of, in the main column as GitHub shows it: a card
 * listing every PR in merge order. Renders nothing unless the PR is stacked.
 */
export function PullStackSection({
	pr,
	owner,
	repo,
	scope,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const { context } = usePullStack({ scope, owner, repo, pr });
	if (!context) return null;

	return (
		<section
			aria-label="Stack"
			className="-mx-[8.5px] rounded-lg border-[0.5px] border-border bg-card p-1.5 shadow-[var(--ln-main-shadow)]"
		>
			<div className="flex h-8 items-center justify-between px-2 text-[13px]">
				<h2 className="font-medium text-text-header">Stack</h2>
				<span className="tabular-nums text-muted-foreground">
					{context.position} of {context.size}
				</span>
			</div>
			<PullStackList
				entries={context.stack.entries}
				currentNumber={pr.number}
				owner={owner}
				repo={repo}
			/>
		</section>
	);
}

/**
 * The stack as a section of the merge card, laid out like its checks row:
 * where this PR sits, and the whole stack under the chevron.
 */
export function PullStackMergeSection({
	pr,
	owner,
	repo,
	scope,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
}) {
	const [open, setOpen] = useState(false);
	const { context } = usePullStack({ scope, owner, repo, pr });
	if (!context) return null;

	const entries = context.stack.entries;
	const at = entries.findIndex((entry) => entry.pull.number === pr.number);
	const below = entries[at - 1]?.pull;
	const target = entries[0]?.pull.baseRefName?.trim();
	const count = `${context.position} of ${context.size} pull requests`;
	const title = below ? `Stacked on #${below.number}` : "Base of a stack";
	const description = below
		? `${count} · #${below.number} merges first`
		: target
			? `${count} · merges into ${target}`
			: count;

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3 text-left transition-colors hover:bg-item-hover"
				>
					<span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-muted-foreground">
						<LayersIcon size={15} strokeWidth={2} />
					</span>
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className="text-[13px] font-medium text-foreground">
							{title}
						</span>
						<span className="text-xs text-muted-foreground">{description}</span>
					</span>
					<span className="mt-0.5 shrink-0 text-muted-foreground">
						<ChevronRightIcon
							size={14}
							strokeWidth={2}
							className={cn(
								"transition-transform duration-150",
								open && "rotate-90",
							)}
						/>
					</span>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="border-b-[0.5px] border-card-border py-2 pr-2 pl-4">
					<PullStackList
						entries={entries}
						currentNumber={pr.number}
						owner={owner}
						repo={repo}
					/>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
