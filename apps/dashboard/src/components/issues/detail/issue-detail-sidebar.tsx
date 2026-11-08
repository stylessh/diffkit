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
			<DetailSidebarSection title="Assignees">
				{issue.assignees.length > 0 ? (
					<div className="flex flex-col gap-2">
						{issue.assignees.map((assignee) => (
							<div key={assignee.login} className="flex items-center gap-2">
								<img
									src={assignee.avatarUrl}
									alt={assignee.login}
									className="size-5 rounded-full border-[0.5px] border-border"
								/>
								<span className="text-sm">{assignee.login}</span>
							</div>
						))}
					</div>
				) : (
					<p className="text-xs text-muted-foreground">No one assigned</p>
				)}
			</DetailSidebarSection>

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
				<DetailSidebarSection title="Milestone">
					<div className="flex flex-col gap-1 text-xs">
						<span className="font-medium text-foreground">
							{issue.milestone.title}
						</span>
						{issue.milestone.dueOn && (
							<span className="text-muted-foreground">
								Due {formatRelativeTime(issue.milestone.dueOn)}
							</span>
						)}
					</div>
				</DetailSidebarSection>
			)}

			<DetailSidebarSection title="Details">
				<div className="flex flex-col gap-2 text-xs">
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
