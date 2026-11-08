import { DetailSidebarSection } from "#/components/details/detail-sidebar";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { PullDetail } from "#/lib/github.types";
import { PullStackList } from "./pull-stack-list";
import { usePullStack } from "./use-pull-stack";

/**
 * "Stack" panel for the PR detail sidebar. Renders nothing unless the PR is
 * part of a branch-derived stack.
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
		<DetailSidebarSection
			title="Stack"
			titleRight={`${context.position} of ${context.size}`}
		>
			<div className="-mx-2 flex flex-col gap-2">
				<PullStackList
					entries={context.stack.entries}
					currentNumber={pr.number}
					owner={owner}
					repo={repo}
					className="max-h-72 overflow-y-auto"
				/>
			</div>
		</DetailSidebarSection>
	);
}
