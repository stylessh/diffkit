import { LineCounts } from "@diffkit/ui/components/detail-layout";
import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SkeletonBox } from "skullet/react";
import type { PullDetail } from "#/lib/github.types";

/** The pull request's Overview / Files changed switch, with the review's controls beside it. */
export function ReviewTabs({
	owner,
	repo,
	pullId,
	pr,
	actions,
}: {
	owner: string;
	repo: string;
	pullId: string;
	pr: Pick<PullDetail, "changedFiles" | "additions" | "deletions"> | undefined;
	actions: ReactNode;
}) {
	return (
		<ViewTabs label="Pull request views" actions={actions}>
			<ViewTab asChild>
				<Link
					to="/$owner/$repo/pull/$pullId"
					params={{ owner, repo, pullId }}
					activeOptions={{ exact: true }}
				>
					Overview
				</Link>
			</ViewTab>
			<ViewTab asChild>
				<Link
					to="/$owner/$repo/review/$pullId"
					params={{ owner, repo, pullId }}
				>
					Files changed
					{pr ? (
						<>
							<ViewTabCount>{pr.changedFiles}</ViewTabCount>
							<LineCounts
								additions={pr.additions}
								deletions={pr.deletions}
								className="ml-1.5 text-xs max-md:hidden"
							/>
						</>
					) : (
						<SkeletonBox width={14} height={12} radius={4} />
					)}
				</Link>
			</ViewTab>
		</ViewTabs>
	);
}
