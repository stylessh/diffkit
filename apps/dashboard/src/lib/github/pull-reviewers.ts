import type {
	GitHubActor,
	PullReviewer,
	PullReviewState,
	RequestedTeam,
} from "../github.types";

/** A User, Bot or Mannequin; any other actor arrives with only its typename. */
type GraphQLReviewerActor = {
	__typename?: string;
	login?: string;
	avatarUrl?: string;
	url?: string;
};

type GraphQLTeam = {
	__typename: "Team";
	name: string;
	slug: string;
	url: string;
};

export type GraphQLReviewRequestNode = {
	requestedReviewer: GraphQLReviewerActor | GraphQLTeam | null;
};

export type GraphQLLatestReviewNode = {
	state: string;
	author: GraphQLReviewerActor | null;
};

const REVIEW_STATES: Record<string, PullReviewState> = {
	APPROVED: "approved",
	CHANGES_REQUESTED: "changes_requested",
	COMMENTED: "commented",
	DISMISSED: "dismissed",
};

function isTeam(
	reviewer: GraphQLReviewerActor | GraphQLTeam,
): reviewer is GraphQLTeam {
	return reviewer.__typename === "Team";
}

/**
 * GraphQL names an app "coderabbitai" where REST, the reviewer picker and the
 * request/remove endpoints call it "coderabbitai[bot]"; reviewers use the REST
 * login so a bot matches its picker row.
 */
function mapReviewerActor(actor: GraphQLReviewerActor): GitHubActor | null {
	if (!actor.login) {
		return null;
	}
	const type = actor.__typename ?? "User";
	const login =
		type === "Bot" && !actor.login.endsWith("[bot]")
			? `${actor.login}[bot]`
			: actor.login;
	return {
		login,
		avatarUrl: actor.avatarUrl ?? "",
		url: actor.url ?? `https://github.com/${login}`,
		type,
	};
}

/**
 * The people, teams and apps GitHub lists under a pull request's Reviewers:
 * pending requests, plus everyone whose latest review is submitted. Apps such
 * as CodeRabbit review without being requested, so they only show up here.
 */
export function mapPullReviewers(
	reviewRequests: Array<GraphQLReviewRequestNode | null>,
	latestReviews: Array<GraphQLLatestReviewNode | null>,
): {
	requestedReviewers: GitHubActor[];
	requestedTeams: RequestedTeam[];
	reviewedBy: PullReviewer[];
} {
	const requestedReviewers: GitHubActor[] = [];
	const requestedTeams: RequestedTeam[] = [];

	for (const node of reviewRequests) {
		const reviewer = node?.requestedReviewer;
		if (!reviewer) {
			continue;
		}
		if (isTeam(reviewer)) {
			requestedTeams.push({
				slug: reviewer.slug,
				name: reviewer.name,
				url: reviewer.url,
			});
			continue;
		}
		const actor = mapReviewerActor(reviewer);
		if (actor) {
			requestedReviewers.push(actor);
		}
	}

	const reviewedBy: PullReviewer[] = [];
	for (const node of latestReviews) {
		const reviewState = node ? REVIEW_STATES[node.state] : undefined;
		const actor = node?.author ? mapReviewerActor(node.author) : null;
		if (reviewState && actor) {
			reviewedBy.push({ ...actor, reviewState });
		}
	}

	return { requestedReviewers, requestedTeams, reviewedBy };
}
