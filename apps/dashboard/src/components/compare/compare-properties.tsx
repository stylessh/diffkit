import { useQuery } from "@tanstack/react-query";
import type { Dispatch } from "react";
import { useMemo } from "react";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import {
	type GitHubQueryScope,
	githubOrgTeamsQueryOptions,
	githubRepoCollaboratorsQueryOptions,
	githubRepoLabelsQueryOptions,
	githubRepoMilestonesQueryOptions,
} from "#/lib/github.query";
import type {
	GitHubLabel,
	OrgTeam,
	RepoCollaborator,
	RepoMilestone,
} from "#/lib/github.types";
import type {
	PullRequestDraft,
	PullRequestDraftAction,
} from "#/lib/pull-request-draft";
import { type PickerOption, PropertyPicker } from "./property-picker";

function Avatar({ src }: { src: string }) {
	return (
		<img
			src={src}
			alt=""
			className="size-3.5 shrink-0 rounded-full ring-[0.5px] ring-chip-border"
		/>
	);
}

function TeamMark() {
	return (
		<span
			aria-hidden
			className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-pill-neutral text-[9px] font-semibold text-muted-foreground"
		>
			T
		</span>
	);
}

function LabelDot({ color }: { color: string }) {
	return (
		<span
			aria-hidden
			className="size-2.5 rounded-full"
			style={{ backgroundColor: `#${color}` }}
		/>
	);
}

const userOption = (user: RepoCollaborator): PickerOption => ({
	key: `user:${user.login}`,
	label: user.login,
	leading: <Avatar src={user.avatarUrl} />,
});

const teamOption = (team: OrgTeam): PickerOption => ({
	key: `team:${team.slug}`,
	label: team.name,
	leading: <TeamMark />,
	group: "Teams",
});

const labelOption = (label: GitHubLabel): PickerOption => ({
	key: label.name,
	label: label.name,
	leading: <LabelDot color={label.color} />,
});

const milestoneOption = (milestone: RepoMilestone): PickerOption => ({
	key: String(milestone.number),
	label: milestone.title,
});

export function CompareProperties({
	owner,
	repo,
	scope,
	viewerLogin,
	draft,
	dispatch,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	viewerLogin: string | null;
	draft: PullRequestDraft;
	dispatch: Dispatch<PullRequestDraftAction>;
}) {
	const enabled = !useIsSkeletonSample();
	const collaboratorsQuery = useQuery({
		...githubRepoCollaboratorsQueryOptions(scope, { owner, repo }),
		enabled,
	});
	const teamsQuery = useQuery({
		...githubOrgTeamsQueryOptions(scope, { org: owner, owner, repo }),
		enabled,
	});
	const labelsQuery = useQuery({
		...githubRepoLabelsQueryOptions(scope, { owner, repo }),
		enabled,
	});
	const milestonesQuery = useQuery({
		...githubRepoMilestonesQueryOptions(scope, { owner, repo }),
		enabled,
	});

	const collaborators = collaboratorsQuery.data ?? [];
	const teams = teamsQuery.data ?? [];
	const labels = labelsQuery.data ?? [];
	const milestones = milestonesQuery.data ?? [];

	const reviewerCandidates = useMemo(
		() => collaborators.filter((c) => c.login !== viewerLogin),
		[collaborators, viewerLogin],
	);
	const reviewerOptions = useMemo(
		() => [...teams.map(teamOption), ...reviewerCandidates.map(userOption)],
		[teams, reviewerCandidates],
	);
	const assigneeOptions = useMemo(
		() => collaborators.filter((c) => c.type !== "Bot").map(userOption),
		[collaborators],
	);
	const labelOptions = useMemo(() => labels.map(labelOption), [labels]);
	const milestoneOptions = useMemo(
		() => milestones.map(milestoneOption),
		[milestones],
	);

	const toggleReviewer = (key: string) => {
		const [kind, id] = key.split(/:(.*)/s);
		if (kind === "team") {
			const team = teams.find((t) => t.slug === id);
			if (team) dispatch({ type: "team-reviewer-toggled", team });
			return;
		}
		const reviewer = reviewerCandidates.find((c) => c.login === id);
		if (reviewer) dispatch({ type: "reviewer-toggled", reviewer });
	};

	return (
		<>
			<PropertyPicker
				label="Reviewers"
				addLabel="Request reviewers"
				placeholder="Request review from…"
				emptyLabel="No one to request"
				options={reviewerOptions}
				selected={[
					...draft.teamReviewers.map(teamOption),
					...draft.reviewers.map(userOption),
				]}
				loading={collaboratorsQuery.isLoading}
				onToggle={toggleReviewer}
			/>
			<PropertyPicker
				label="Assignees"
				addLabel="Assign people"
				placeholder="Assign to…"
				emptyLabel="No collaborators"
				options={assigneeOptions}
				selected={draft.assignees.map(userOption)}
				loading={collaboratorsQuery.isLoading}
				onToggle={(key) => {
					const assignee = collaborators.find((c) => `user:${c.login}` === key);
					if (assignee) dispatch({ type: "assignee-toggled", assignee });
				}}
			/>
			<PropertyPicker
				label="Labels"
				addLabel="Add labels"
				placeholder="Change labels…"
				emptyLabel="No labels in this repository"
				options={labelOptions}
				selected={draft.labels.map(labelOption)}
				loading={labelsQuery.isLoading}
				onToggle={(key) => {
					const label = labels.find((l) => l.name === key);
					if (label) dispatch({ type: "label-toggled", label });
				}}
			/>
			<PropertyPicker
				label="Milestone"
				addLabel="Set milestone"
				placeholder="Set milestone…"
				emptyLabel="No open milestones"
				options={milestoneOptions}
				selected={draft.milestone ? [milestoneOption(draft.milestone)] : []}
				loading={milestonesQuery.isLoading}
				onToggle={(key) => {
					const milestone = milestones.find((m) => String(m.number) === key);
					if (!milestone) return;
					dispatch({
						type: "milestone-selected",
						milestone:
							draft.milestone?.number === milestone.number ? null : milestone,
					});
				}}
			/>
		</>
	);
}
