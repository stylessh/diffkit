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
	headRepoOwner: string | null;
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
	forbiddenOrgs?: string[];
	timedOut?: boolean;
};

export type MyIssuesResult = {
	assigned: IssueSummary[];
	authored: IssueSummary[];
	mentioned: IssueSummary[];
	forbiddenOrgs?: string[];
	timedOut?: boolean;
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

export type GroupedLabelEvent = {
	actor: GitHubActor | null;
	added: { name: string; color: string }[];
	removed: { name: string; color: string }[];
	createdAt: string;
};

export type GroupedReviewRequestEvent = {
	actor: GitHubActor | null;
	requested: (GitHubActor | { login: string })[];
	removed: (GitHubActor | { login: string })[];
	createdAt: string;
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
	conflictingFiles: string[];
	behindBy: number | null;
	baseRefName: string;
	canUpdateBranch: boolean;
	canBypassProtections: boolean;
	canMerge: boolean;
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
	nodeId: string;
	pullRequestReviewId: number | null;
	body: string;
	path: string;
	line: number | null;
	startLine: number | null;
	side: "LEFT" | "RIGHT";
	createdAt: string;
	updatedAt: string;
	author: GitHubActor | null;
	inReplyToId: number | null;
	diffHunk: string;
};

export type ReviewThreadInfo = {
	threadId: string;
	isResolved: boolean;
	/** The database ID of the first comment in this thread */
	firstCommentId: number;
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

export type ReplyToReviewCommentInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	commentId: number;
	body: string;
};

export type GitHubUserProfile = {
	id: number;
	login: string;
	name: string | null;
	avatarUrl: string;
	bio: string | null;
	company: string | null;
	location: string | null;
	blog: string | null;
	twitterUsername: string | null;
	followers: number;
	following: number;
	publicRepos: number;
	createdAt: string;
	url: string;
};

export type ContributionDay = {
	date: string;
	count: number;
	level: 0 | 1 | 2 | 3 | 4;
};

export type ContributionWeek = {
	days: ContributionDay[];
};

export type GitHubContributionCalendar = {
	totalContributions: number;
	weeks: ContributionWeek[];
};

export type PinnedRepo = {
	name: string;
	description: string | null;
	stars: number;
	language: string | null;
	languageColor: string | null;
	url: string;
	owner: string;
	isPrivate: boolean;
	forks: number;
};

export type RepoOverview = {
	id: number;
	name: string;
	fullName: string;
	description: string | null;
	isPrivate: boolean;
	isFork: boolean;
	defaultBranch: string;
	stars: number;
	forks: number;
	watchers: number;
	language: string | null;
	license: string | null;
	topics: string[];
	url: string;
	owner: string;
	ownerAvatarUrl: string;
	branchCount: number;
	tagCount: number;
	openPullCount: number;
	openIssueCount: number;
	hasDiscussions: boolean;
	latestCommit: {
		sha: string;
		message: string;
		date: string;
		author: GitHubActor | null;
	} | null;
};

export type RepoTreeEntry = {
	name: string;
	type: "file" | "dir" | "submodule";
	path: string;
	sha: string;
	size: number | null;
	lastCommit: {
		message: string;
		date: string;
	} | null;
};

export type FileLastCommit = {
	sha: string;
	message: string;
	date: string;
	author: GitHubActor | null;
};

export type RepoBranch = {
	name: string;
	isProtected: boolean;
};

export type RepoContributor = {
	login: string;
	avatarUrl: string;
	contributions: number;
};

export type RepoContributorsResult = {
	contributors: RepoContributor[];
	totalCount: number;
};

export type UserActivityEvent = {
	id: string;
	type: string;
	createdAt: string;
	repo: { name: string; url: string };
	actor: { login: string; avatarUrl: string };
	action: string | null;
	title: string | null;
	ref: string | null;
	refType: string | null;
	commits: Array<{ sha: string; message: string }> | null;
	commentBody: string | null;
	prDetail: {
		number: number;
		body: string | null;
		additions: number;
		deletions: number;
		comments: number;
		changedFiles: number;
		state: string;
		isDraft: boolean;
		url: string;
		headRef: string | null;
		baseRef: string | null;
		labels: Array<{ name: string; color: string }>;
	} | null;
	issueDetail: {
		number: number;
		body: string | null;
		comments: number;
		state: string;
		url: string;
	} | null;
};

export type DiscussionSummary = {
	number: number;
	title: string;
	createdAt: string;
	updatedAt: string;
	author: { login: string; avatarUrl: string } | null;
	category: string | null;
	comments: number;
	isAnswered: boolean;
	url: string;
};

export type DiscussionsResult = {
	discussions: DiscussionSummary[];
	totalCount: number;
};

export type NotificationSubject = {
	title: string;
	url: string | null;
	latestCommentUrl: string | null;
	type:
		| "CheckSuite"
		| "Commit"
		| "Discussion"
		| "Issue"
		| "PullRequest"
		| "Release"
		| "RepositoryVulnerabilityAlert"
		| "RepositoryDependabotAlertsThread"
		| "RepositoryAdvisory"
		| (string & {});
};

export type NotificationParticipant = {
	login: string;
	avatarUrl: string;
};

export type NotificationItem = {
	id: string;
	unread: boolean;
	reason:
		| "assign"
		| "author"
		| "comment"
		| "ci_activity"
		| "invitation"
		| "manual"
		| "mention"
		| "review_requested"
		| "security_alert"
		| "state_change"
		| "subscribed"
		| "team_mention"
		| (string & {});
	subject: NotificationSubject;
	repository: {
		id: number;
		name: string;
		fullName: string;
		owner: GitHubActor;
		private: boolean;
	};
	participants: NotificationParticipant[];
	subjectState: "open" | "closed" | "merged" | null;
	updatedAt: string;
	lastReadAt: string | null;
	url: string;
};

export type NotificationsResult = {
	notifications: NotificationItem[];
};
