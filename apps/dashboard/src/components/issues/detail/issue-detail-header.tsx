import { IssuesIcon } from "@diffkit/icons";
import { Markdown } from "@diffkit/ui/components/markdown";
import { cn } from "@diffkit/ui/lib/utils";
import { useState } from "react";
import { IssueCommentReactionBar } from "#/components/details/comment-reaction-bar";
import { DetailPageTitle } from "#/components/details/detail-page";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { IssueDetail } from "#/lib/github.types";
import { usePrefersNoHover } from "#/lib/use-prefers-no-hover";

type IssueStateConfig = {
	color: string;
	label: string;
	badgeClass: string;
};

export function getIssueStateConfig(issue: IssueDetail): IssueStateConfig {
	if (issue.state === "closed") {
		if (issue.stateReason === "not_planned") {
			return {
				color: "text-muted-foreground",
				label: "Closed",
				badgeClass: "bg-muted text-muted-foreground",
			};
		}
		return {
			color: "text-purple-500",
			label: "Closed",
			badgeClass: "bg-purple-500/10 text-purple-500",
		};
	}
	return {
		color: "text-green-500",
		label: "Open",
		badgeClass: "bg-green-500/10 text-green-500",
	};
}

export function IssueDetailHeader({
	owner,
	repo,
	issue,
	scope,
	viewerLogin,
}: {
	owner: string;
	repo: string;
	issue: IssueDetail;
	scope: GitHubQueryScope;
	viewerLogin?: string | null;
}) {
	const [descActive, setDescActive] = useState(false);
	const prefersNoHover = usePrefersNoHover();
	const stateConfig = getIssueStateConfig(issue);

	return (
		<>
			<DetailPageTitle
				collectionHref="/issues"
				collectionLabel="Issues"
				owner={owner}
				repo={repo}
				number={issue.number}
				icon={IssuesIcon}
				iconClassName={stateConfig.color}
				title={issue.title}
				subtitle={
					<div className="flex flex-wrap items-center gap-2">
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
								stateConfig.badgeClass,
							)}
						>
							{stateConfig.label}
						</span>
						{issue.author && (
							<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
								<img
									src={issue.author.avatarUrl}
									alt={issue.author.login}
									className="size-4 rounded-full border border-border"
								/>
								<span className="font-medium text-foreground">
									{issue.author.login}
								</span>
								<span>opened {formatRelativeTime(issue.createdAt)}</span>
							</span>
						)}
					</div>
				}
			/>

			<div className="rounded-lg border bg-surface-0 p-5">
				<div
					className="group/description flex flex-col"
					onPointerEnter={() => setDescActive(true)}
					onPointerLeave={() => setDescActive(false)}
					onFocusCapture={() => setDescActive(true)}
					onBlurCapture={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
							setDescActive(false);
						}
					}}
				>
					{issue.body ? (
						<Markdown>{issue.body}</Markdown>
					) : (
						<p className="text-sm italic text-muted-foreground">
							No description provided.
						</p>
					)}
					{issue.graphqlId ? (
						<IssueCommentReactionBar
							className="mt-3 justify-start"
							revealZeroCount={descActive || prefersNoHover}
							viewerLogin={viewerLogin}
							owner={owner}
							repo={repo}
							issueNumber={issue.number}
							commentGraphqlId={issue.graphqlId}
							scope={scope}
							reactions={issue.reactions}
							variant="detail"
							detailPage="issue"
						/>
					) : null}
				</div>
			</div>
		</>
	);
}
