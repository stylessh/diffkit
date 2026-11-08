import {
	PanelGoButton,
	PanelRow,
	PanelSection,
} from "@diffkit/ui/components/detail-layout";
import { Link } from "@tanstack/react-router";
import {
	DetailParticipantAvatars,
	DetailSidebar,
	DetailSidebarRow,
	DetailSidebarSection,
} from "#/components/details/detail-sidebar";
import { LabelsSection } from "#/components/issues/labels-section";
import { formatRelativeTime } from "#/lib/format-relative-time";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type {
	GitHubActor,
	IssueComment,
	IssueDetail,
} from "#/lib/github.types";

export function IssueDetailSidebar({
	issue,
	owner,
	repo,
	issueNumber,
	scope,
	comments,
}: {
	issue: IssueDetail;
	owner: string;
	repo: string;
	issueNumber: number;
	scope: GitHubQueryScope;
	comments: IssueComment[];
}) {
	return (
		<DetailSidebar>
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

			<DetailSidebarSection title="Participants">
				<ParticipantsList issue={issue} comments={comments} />
			</DetailSidebarSection>

			{issue.milestone && (
				<PanelSection label="Milestone">
					<PanelRow>
						{issue.milestone.title}
						{issue.milestone.dueOn ? (
							<span className="font-[450] text-muted-foreground">
								due {formatRelativeTime(issue.milestone.dueOn)}
							</span>
						) : null}
					</PanelRow>
				</PanelSection>
			)}

			<DetailSidebarSection title="Details">
				<div className="flex flex-col gap-1">
					<DetailSidebarRow label="Created">
						{formatRelativeTime(issue.createdAt)}
					</DetailSidebarRow>
					<DetailSidebarRow label="Updated">
						{formatRelativeTime(issue.updatedAt)}
					</DetailSidebarRow>
					{issue.closedAt && (
						<DetailSidebarRow label="Closed">
							{formatRelativeTime(issue.closedAt)}
						</DetailSidebarRow>
					)}
					<DetailSidebarRow label="Comments">
						<span className="tabular-nums">{issue.comments}</span>
					</DetailSidebarRow>
				</div>
			</DetailSidebarSection>
		</DetailSidebar>
	);
}

function ParticipantsList({
	issue,
	comments,
}: {
	issue: IssueDetail;
	comments: IssueComment[];
}) {
	const seen = new Set<string>();
	const participants: GitHubActor[] = [];

	const addActor = (actor: GitHubActor | null) => {
		if (actor && !seen.has(actor.login)) {
			seen.add(actor.login);
			participants.push(actor);
		}
	};

	addActor(issue.author);
	for (const assignee of issue.assignees) {
		addActor(assignee);
	}
	for (const comment of comments) {
		addActor(comment.author);
	}

	if (participants.length === 0) {
		return <p className="text-xs text-muted-foreground">No participants yet</p>;
	}

	return <DetailParticipantAvatars actors={participants} />;
}
