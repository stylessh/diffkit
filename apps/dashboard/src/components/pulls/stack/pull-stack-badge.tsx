import { LayersIcon } from "@diffkit/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import type { PullDetail } from "#/lib/github.types";
import { PullStackList } from "./pull-stack-list";
import { usePullStack } from "./use-pull-stack";

const protectedRoute = getRouteApi("/_protected");

/**
 * Compact "Stack 2/3" chip with a popover listing the chain, for the review
 * page toolbar. Renders nothing unless the PR is part of a stack.
 */
export function PullStackBadge({
	pr,
	owner,
	repo,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
}) {
	const { user } = protectedRoute.useRouteContext();
	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const { context } = usePullStack({ scope, owner, repo, pr });
	if (!context) return null;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-button px-2.5 text-xs font-medium text-text-header shadow-button transition-colors hover:bg-button-hover hover:text-foreground data-[state=open]:bg-button-hover"
					aria-label={`Stacked pull request ${context.position} of ${context.size}`}
				>
					<LayersIcon size={13} strokeWidth={2} />
					<span className="hidden sm:inline">Stack</span>
					<span className="tabular-nums">
						{context.position}/{context.size}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 p-2" sideOffset={8}>
				<p className="px-2 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">
					Stack · {context.position} of {context.size}
				</p>
				<PullStackList
					entries={context.stack.entries}
					currentNumber={pr.number}
					owner={owner}
					repo={repo}
					className="max-h-72 overflow-y-auto"
				/>
			</PopoverContent>
		</Popover>
	);
}
