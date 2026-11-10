import {
	type GitHubContext,
	type MutationFailure,
	toMutationError,
} from "./shared";

export type CreatePullRequestInput = {
	owner: string;
	repo: string;
	title: string;
	body?: string;
	base: string;
	head: string;
	draft?: boolean;
	labels?: string[];
	assignees?: string[];
	reviewers?: string[];
	teamReviewers?: string[];
	milestone?: number;
};

export type CreatePullRequestResult =
	| { ok: true; pullNumber: number; warnings?: string[] }
	| MutationFailure;

type FollowUp = { name: string; start: () => Promise<unknown> };

/** Labels, assignees, milestone and reviewers are not part of pull creation. */
function planFollowUps(
	context: GitHubContext,
	data: CreatePullRequestInput,
	pullNumber: number,
): FollowUp[] {
	const repository = { owner: data.owner, repo: data.repo };
	const {
		labels = [],
		assignees = [],
		reviewers = [],
		teamReviewers = [],
	} = data;
	const followUps: FollowUp[] = [];

	if (labels.length > 0) {
		followUps.push({
			name: "addLabels",
			start: () =>
				context.octokit.rest.issues.addLabels({
					...repository,
					issue_number: pullNumber,
					labels,
				}),
		});
	}
	if (assignees.length > 0) {
		followUps.push({
			name: "addAssignees",
			start: () =>
				context.octokit.rest.issues.addAssignees({
					...repository,
					issue_number: pullNumber,
					assignees,
				}),
		});
	}
	if (data.milestone !== undefined) {
		followUps.push({
			name: "setMilestone",
			start: () =>
				context.octokit.rest.issues.update({
					...repository,
					issue_number: pullNumber,
					milestone: data.milestone,
				}),
		});
	}
	if (reviewers.length > 0 || teamReviewers.length > 0) {
		followUps.push({
			name: "requestReviewers",
			start: () =>
				context.octokit.rest.pulls.requestReviewers({
					...repository,
					pull_number: pullNumber,
					reviewers,
					team_reviewers: teamReviewers,
				}),
		});
	}
	return followUps;
}

export async function createPullRequestWithFollowUps(
	context: GitHubContext,
	data: CreatePullRequestInput,
): Promise<CreatePullRequestResult> {
	try {
		const response = await context.octokit.rest.pulls.create({
			owner: data.owner,
			repo: data.repo,
			title: data.title,
			body: data.body,
			base: data.base,
			head: data.head,
			draft: data.draft ?? false,
		});
		const pullNumber = response.data.number;

		const followUps = planFollowUps(context, data, pullNumber);
		const outcomes = await Promise.allSettled(
			followUps.map((followUp) => followUp.start()),
		);
		const warnings = outcomes.flatMap((outcome, index) => {
			if (outcome.status === "fulfilled") {
				return [];
			}
			const { name } = followUps[index];
			const { reason } = outcome;
			console.error(`[create pull request] ${name} failed`, reason);
			return [
				`${name}: ${reason instanceof Error ? reason.message : String(reason)}`,
			];
		});

		return {
			ok: true,
			pullNumber,
			...(warnings.length > 0 ? { warnings } : {}),
		};
	} catch (error) {
		return toMutationError("create pull request", error);
	}
}
