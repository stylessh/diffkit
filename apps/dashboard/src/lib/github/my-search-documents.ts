import type { IssueSummary, PullSummary } from "../github.types";
import {
	mapGraphQLActor,
	mapGraphQLLabels,
	mapGraphQLRepositoryRef,
} from "./mappers";
import type {
	GitHubGraphQLActor,
	GitHubGraphQLLabel,
	GitHubGraphQLRateLimit,
	GitHubGraphQLRepositoryRef,
} from "./shared";

type GitHubGraphQLSearchConnection<TNode> = {
	nodes: Array<TNode | null> | null;
};
type GitHubGraphQLPullSearchNode = {
	__typename: "PullRequest";
	databaseId: number | null;
	number: number;
	title: string;
	state: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	mergedAt: string | null;
	url: string;
	additions: number;
	deletions: number;
	comments: {
		totalCount: number;
	};
	author: GitHubGraphQLActor;
	labels: {
		nodes: Array<GitHubGraphQLLabel | null> | null;
	} | null;
	repository: GitHubGraphQLRepositoryRef;
};
type GitHubGraphQLIssueSearchNode = {
	__typename: "Issue";
	databaseId: number | null;
	number: number;
	title: string;
	state: string;
	stateReason: string | null;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	url: string;
	comments: {
		totalCount: number;
	};
	author: GitHubGraphQLActor;
	labels: {
		nodes: Array<GitHubGraphQLLabel | null> | null;
	} | null;
	repository: GitHubGraphQLRepositoryRef;
};
function mapGraphQLPullSearchNode(
	node: GitHubGraphQLPullSearchNode | null,
): PullSummary | null {
	if (!node || node.__typename !== "PullRequest" || node.databaseId == null) {
		return null;
	}

	return {
		id: node.databaseId,
		number: node.number,
		title: node.title,
		state: node.state.toLowerCase(),
		isDraft: node.isDraft,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
		closedAt: node.closedAt,
		mergedAt: node.mergedAt,
		additions: node.additions,
		deletions: node.deletions,
		comments: node.comments.totalCount,
		url: node.url,
		author: mapGraphQLActor(node.author),
		labels: mapGraphQLLabels(node.labels),
		repository: mapGraphQLRepositoryRef(node.repository),
	};
}

function mapGraphQLIssueSearchNode(
	node: GitHubGraphQLIssueSearchNode | null,
): IssueSummary | null {
	if (!node || node.__typename !== "Issue" || node.databaseId == null) {
		return null;
	}

	return {
		id: node.databaseId,
		number: node.number,
		title: node.title,
		state: node.state.toLowerCase(),
		stateReason: node.stateReason?.toLowerCase() ?? null,
		createdAt: node.createdAt,
		updatedAt: node.updatedAt,
		closedAt: node.closedAt,
		comments: node.comments.totalCount,
		url: node.url,
		author: mapGraphQLActor(node.author),
		labels: mapGraphQLLabels(node.labels),
		repository: mapGraphQLRepositoryRef(node.repository),
	};
}

export type GraphQLMyPullsResponse = {
	reviewRequested: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	assigned: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	authored: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	mentioned: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	involved: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>;
	rateLimit: GitHubGraphQLRateLimit;
};

export type GraphQLMyIssuesResponse = {
	assigned: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	authored: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	mentioned: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>;
	rateLimit: GitHubGraphQLRateLimit;
};

export function mapGraphQLPullSearchConnection(
	connection: GitHubGraphQLSearchConnection<GitHubGraphQLPullSearchNode>,
) {
	return (connection.nodes ?? [])
		.map((node) => mapGraphQLPullSearchNode(node))
		.filter((item): item is PullSummary => Boolean(item));
}

export function mapGraphQLIssueSearchConnection(
	connection: GitHubGraphQLSearchConnection<GitHubGraphQLIssueSearchNode>,
) {
	return (connection.nodes ?? [])
		.map((node) => mapGraphQLIssueSearchNode(node))
		.filter((item): item is IssueSummary => Boolean(item));
}

export const MY_PULLS_SEARCH_QUERY = `query(
	$reviewRequestedQuery: String!
	$assignedQuery: String!
	$authoredQuery: String!
	$mentionedQuery: String!
	$involvedQuery: String!
) {
	reviewRequested: search(type: ISSUE, first: 30, query: $reviewRequestedQuery) {
		nodes { ...PullSearchFields }
	}
	assigned: search(type: ISSUE, first: 30, query: $assignedQuery) {
		nodes { ...PullSearchFields }
	}
	authored: search(type: ISSUE, first: 30, query: $authoredQuery) {
		nodes { ...PullSearchFields }
	}
	mentioned: search(type: ISSUE, first: 30, query: $mentionedQuery) {
		nodes { ...PullSearchFields }
	}
	involved: search(type: ISSUE, first: 30, query: $involvedQuery) {
		nodes { ...PullSearchFields }
	}
	rateLimit {
		cost
		remaining
		resetAt
	}
}

fragment PullSearchFields on PullRequest {
	__typename
	databaseId
	number
	title
	state
	isDraft
	createdAt
	updatedAt
	closedAt
	mergedAt
	url
	additions
	deletions
	comments {
		totalCount
	}
	author {
		__typename
		login
		avatarUrl
		url
	}
	labels(first: 20) {
		nodes {
			name
			color
			description
		}
	}
	repository {
		name
		nameWithOwner
		url
		isPrivate
		owner {
			login
			avatarUrl(size: 32)
		}
	}
}`;

export const MY_ISSUES_SEARCH_QUERY = `query(
	$assignedQuery: String!
	$authoredQuery: String!
	$mentionedQuery: String!
) {
	assigned: search(type: ISSUE, first: 30, query: $assignedQuery) {
		nodes { ...IssueSearchFields }
	}
	authored: search(type: ISSUE, first: 30, query: $authoredQuery) {
		nodes { ...IssueSearchFields }
	}
	mentioned: search(type: ISSUE, first: 30, query: $mentionedQuery) {
		nodes { ...IssueSearchFields }
	}
	rateLimit {
		cost
		remaining
		resetAt
	}
}

fragment IssueSearchFields on Issue {
	__typename
	databaseId
	number
	title
	state
	stateReason
	createdAt
	updatedAt
	closedAt
	url
	comments {
		totalCount
	}
	author {
		__typename
		login
		avatarUrl
		url
	}
	labels(first: 20) {
		nodes {
			name
			color
			description
		}
	}
	repository {
		name
		nameWithOwner
		url
		isPrivate
		owner {
			login
			avatarUrl(size: 32)
		}
	}
}`;
