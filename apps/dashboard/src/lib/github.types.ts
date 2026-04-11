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

export type GitHubAccountSummary = {
	id: number;
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

export type RequestedTeam = {
	slug: string;
	name: string;
	url: string;
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
	mergeCommitSha: string | null;
	mergedBy: GitHubActor | null;
	mergeable: boolean | null;
	mergeableState?: string | null;
	requestedReviewers: GitHubActor[];
	requestedTeams: RequestedTeam[];
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

export type CommandPaletteSearchResult = {
	pulls: PullSummary[];
	issues: IssueSummary[];
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

export type TimelineEvent = {
	id: number;
	event: string;
	createdAt: string;
	actor: GitHubActor | null;
	label?: { name: string; color: string };
	assignee?: GitHubActor | null;
	requestedReviewer?: GitHubActor | null;
	requestedTeam?: { name: string; slug: string } | null;
	rename?: { from: string; to: string };
	source?: {
		type: "issue" | "pull_request";
		number: number;
		title: string;
		state: string;
		url: string;
		repository: string | null;
	} | null;
	milestone?: { title: string } | null;
	reviewState?: string;
	body?: string;
};

export type IssuePageData = {
	detail: IssueDetail | null;
	comments: IssueComment[];
	events: TimelineEvent[];
	commentPagination: CommentPagination;
	eventPagination: EventPagination;
};

export type PullCheckRun = {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	appAvatarUrl: string | null;
	outputTitle: string | null;
	startedAt: string | null;
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
	checkRuns: PullCheckRun[];
	mergeable: boolean | null;
	mergeableState: string | null;
	behindBy: number | null;
	baseRefName: string;
	canUpdateBranch: boolean;
	canBypassProtections: boolean;
};

export type PullCommit = {
	sha: string;
	message: string;
	createdAt: string;
	author: GitHubActor | null;
};

export type CommentPagination = {
	totalCount: number;
	perPage: number;
	loadedPages: number[];
};

export type EventPagination = {
	loadedPages: number[];
	hasMore: boolean;
};

export type PullPageData = {
	detail: PullDetail | null;
	comments: PullComment[];
	commits: PullCommit[];
	events: TimelineEvent[];
	commentPagination: CommentPagination;
	eventPagination: EventPagination;
	headRefDeleted: boolean;
};

export type PullFile = {
	sha: string | null;
	filename: string;
	status:
		| "added"
		| "removed"
		| "modified"
		| "renamed"
		| "copied"
		| "changed"
		| "unchanged";
	additions: number;
	deletions: number;
	changes: number;
	patch: string | null;
	previousFilename: string | null;
};

export type PullFileSummary = Omit<PullFile, "patch" | "sha">;

export type PullFilesPageInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	page?: number;
	perPage?: number;
};

export type PullFilesPage = {
	files: PullFile[];
	nextPage: number | null;
};

export type PullReviewComment = {
	id: number;
	body: string;
	path: string;
	line: number | null;
	side: "LEFT" | "RIGHT";
	createdAt: string;
	updatedAt: string;
	author: GitHubActor | null;
	inReplyToId: number | null;
	diffHunk: string;
};

export type SubmitReviewInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	body: string;
	event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
	comments?: Array<{
		path: string;
		line: number;
		side: "LEFT" | "RIGHT";
		body: string;
		startLine?: number;
		startSide?: "LEFT" | "RIGHT";
	}>;
};

export type RepoCollaborator = {
	login: string;
	avatarUrl: string;
	url: string;
	type: string;
	permissions: {
		admin: boolean;
		push: boolean;
		pull: boolean;
	};
};

export type RequestReviewersInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	reviewers?: string[];
	teamReviewers?: string[];
};

export type CreateLabelInput = {
	owner: string;
	repo: string;
	name: string;
	color: string;
};

export type SetLabelsInput = {
	owner: string;
	repo: string;
	issueNumber: number;
	labels: string[];
};

export type OrgTeam = {
	slug: string;
	name: string;
};

export type CreateReviewCommentInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	body: string;
	commitId: string;
	path: string;
	line: number;
	side: "LEFT" | "RIGHT";
};
