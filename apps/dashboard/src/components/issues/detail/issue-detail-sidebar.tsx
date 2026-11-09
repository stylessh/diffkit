import { IssuesIcon, MilestoneIcon } from "@diffkit/icons";
import {
	PanelGoButton,
	PanelRow,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import { Link } from "@tanstack/react-router";
import {
	DetailSidebar,
	RepoRow,
	UpdatedRow,
} from "#/components/details/detail-sidebar";
import { getIssueStateConfig } from "#/components/issues/detail/issue-detail-header";
import { LabelsSection } from "#/components/issues/labels-section";
import { formatRelativeTime } from "#/lib/format-relative-time";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type { IssueDetail } from "#/lib/github.types";

export function IssueDetailSidebar({
	issue,
	owner,
	repo,
	issueNumber,
	scope,
}: {
	issue: IssueDetail;
	owner: string;
	repo: string;
	issueNumber: number;
	scope: GitHubQueryScope;
}) {
	const state = getIssueStateConfig(issue);
	return (
		<DetailSidebar>
			<PanelSection label="Properties">
				<RepoRow owner={owner} repo={repo} />
				<PanelRow
					muted
					icon={
						<IssuesIcon size={14} strokeWidth={2} className={state.color} />
					}
				>
					{state.label}
				</PanelRow>
				{issue.milestone ? (
					<PanelRow muted icon={<MilestoneIcon size={14} strokeWidth={2} />}>
						{issue.milestone.title}
						{issue.milestone.dueOn ? (
							<span className="font-[450] text-muted-foreground">
								due {formatRelativeTime(issue.milestone.dueOn)}
							</span>
						) : null}
					</PanelRow>
				) : null}
				<UpdatedRow at={issue.closedAt ?? issue.updatedAt} />
			</PanelSection>

			<LabelsSection
				currentLabels={issue.labels}
				owner={owner}
				repo={repo}
				issueNumber={issueNumber}
				scope={scope}
				pageQueryKey={githubQueryKeys.issues.page(scope, {
					owner,
					repo,
					issueNumber,
				})}
			/>

			<PanelSection label="Assignees">
				{issue.assignees.length > 0 ? (
					issue.assignees.map((assignee) => (
						<PanelRow
							key={assignee.login}
							icon={
								<img
									src={assignee.avatarUrl}
									alt=""
									className="size-3.5 rounded-full ring-[0.5px] ring-chip-border"
								/>
							}
							go={
								<PanelGoButton asChild aria-label={`Open ${assignee.login}`}>
									<Link to="/$owner" params={{ owner: assignee.login }} />
								</PanelGoButton>
							}
						>
							{assignee.login}
						</PanelRow>
					))
				) : (
					<PanelRow muted>No one assigned</PanelRow>
				)}
			</PanelSection>
		</DetailSidebar>
	);
}
