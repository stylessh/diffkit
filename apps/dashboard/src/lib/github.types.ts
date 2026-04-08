export type RepositoryRef = {
	name: string;
	owner: string;
	fullName: string;
	url: string;
};

export type GitHubActor = {
	login: string;
	avatarUrl: string;
	url: string;
	type: string;
};

export type GitHubLabel = {
	name: string;
	color: string;
	description: string | null;
};

export type UserRepoSummary = {
	id: number;
	name: string;
	fullName: string;
	description: string | null;
	stars: number;
	language: string | null;
	updatedAt: string | null;
	isPrivate: boolean;
	url: string;
	owner: string;
};

export type PullSummary = {
	id: number;
	number: number;
	title: string;
	state: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	mergedAt: string | null;
	comments: number;
	url: string;
	author: GitHubActor | null;
	labels: GitHubLabel[];
	repository: RepositoryRef;
};

export type PullDetail = PullSummary & {
	body: string;
	additions: number;
	deletions: number;
	changedFiles: number;
	commits: number;
	reviewComments: number;
	headRefName: string;
	headSha: string;
	baseRefName: string;
	isMerged: boolean;
	mergeable: boolean | null;
	mergeableState?: string | null;
	requestedReviewers: GitHubActor[];
};

export type IssueSummary = {
	id: number;
	number: number;
	title: string;
	state: string;
	stateReason: string | null;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	comments: number;
	url: string;
	author: GitHubActor | null;
	labels: GitHubLabel[];
	repository: RepositoryRef;
};

export type IssueDetail = IssueSummary & {
	body: string;
	assignees: GitHubActor[];
	milestone: {
		title: string;
		description: string | null;
		dueOn: string | null;
	} | null;
};

export type MyPullsResult = {
	reviewRequested: PullSummary[];
	assigned: PullSummary[];
	authored: PullSummary[];
	mentioned: PullSummary[];
	involved: PullSummary[];
};

export type MyIssuesResult = {
	assigned: IssueSummary[];
	authored: IssueSummary[];
	mentioned: IssueSummary[];
};

export type PullComment = {
	id: number;
	body: string;
	createdAt: string;
	author: GitHubActor | null;
};

export type IssueComment = {
	id: number;
	body: string;
	createdAt: string;
	author: GitHubActor | null;
};

export type PullCheckRun = {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
};

export type PullReview = {
	id: number;
	state: string;
	author: GitHubActor | null;
};

export type PullStatus = {
	reviews: PullReview[];
	checks: {
		total: number;
		passed: number;
		failed: number;
		pending: number;
		skipped: number;
	};
	mergeable: boolean | null;
	mergeableState: string | null;
	behindBy: number | null;
	baseRefName: string;
	canUpdateBranch: boolean;
};
