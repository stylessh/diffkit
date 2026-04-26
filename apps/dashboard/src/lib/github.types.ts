export type RepositoryRef = {
	name: string;
	owner: string;
	fullName: string;
	url: string;
	/** `null` means the visibility is unknown (e.g. REST search doesn't return it). */
	isPrivate: boolean | null;
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

/** Weekly total commit counts; index `0` is oldest week, last index is most recent (GitHub participation API). */
export type RepoParticipationStats = {
	weeklyCommits: number[];
};

export type UserRepoSummary = {
	id: number;
	name: string;
	fullName: string;
	description: string | null;
	stars: number;
	forks: number;
	language: string | null;
	updatedAt: string | null;
	createdAt: string | null;
	isPrivate: boolean;
	/** GitHub visibility (`internal` on Enterprise); derived when the API omits `visibility`. */
	visibility: "public" | "private" | "internal";
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
	/** GraphQL node id (`I_kwD...` / `PR_kwD...`); required for reactions API */
	graphqlId?: string;
	reactions?: CommentReactionSummary;
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
	/** GraphQL node id (`I_kwD...`); required for reactions API */
	graphqlId?: string;
	reactions?: CommentReactionSummary;
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
	partial?: boolean;
	timedOut?: boolean;
	__meta?: GitHubLocalFirstMeta;
};

export type MyIssuesResult = {
	assigned: IssueSummary[];
	authored: IssueSummary[];
	mentioned: IssueSummary[];
	forbiddenOrgs?: string[];
	partial?: boolean;
	timedOut?: boolean;
	__meta?: GitHubLocalFirstMeta;
};

export type CommandPaletteSearchResult = {
	pulls: PullSummary[];
	issues: IssueSummary[];
};

/** GitHub REST reaction `content` values for issue/PR comments */
export type CommentReactionContent =
	| "+1"
	| "-1"
	| "laugh"
	| "confused"
	| "heart"
	| "hooray"
	| "rocket"
	| "eyes";

export type CommentReactionSummary = {
	counts: Partial<Record<CommentReactionContent, number>>;
	/** Reaction types the authenticated user has left on this comment */
	viewerReacted: CommentReactionContent[];
	/** User logins per reaction type (API order; used for tooltips) */
	userLoginsByContent?: Partial<Record<CommentReactionContent, string[]>>;
};

export type PullComment = {
	id: number;
	/** GraphQL node id (`IC_kwD...`); required for reactions API */
	graphqlId?: string;
	body: string;
	createdAt: string;
	author: GitHubActor | null;
	reactions?: CommentReactionSummary;
};

export type IssueComment = {
	id: number;
	/** GraphQL node id (`IC_kwD...`); required for reactions API */
	graphqlId?: string;
	body: string;
	createdAt: string;
	author: GitHubActor | null;
	reactions?: CommentReactionSummary;
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
	/** Issue/PR close: REST `state_reason` (e.g. completed, not_planned) */
	stateReason?: string;
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

/** Consecutive reopen/close by the same actor within the grouping window */
export type GroupedIssueStateToggleEvent = {
	actor: GitHubActor | null;
	events: TimelineEvent[];
	createdAt: string;
};

export type IssuePageData = {
	detail: IssueDetail | null;
	comments: IssueComment[];
	events: TimelineEvent[];
	commentPagination: CommentPagination;
	eventPagination: EventPagination;
	__meta?: GitHubLocalFirstMeta;
};

export type PullCheckRun = {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	appAvatarUrl: string | null;
	outputTitle: string | null;
	startedAt: string | null;
	htmlUrl: string | null;
	required: boolean;
	workflowRunId: number | null;
};

export type PullWorkflowApproval = {
	workflowRunId: number;
	name: string;
	event: string;
};

export type WorkflowRunPullRequestRef = {
	number: number;
	headRef: string;
	baseRef: string;
};

export type WorkflowRun = {
	id: number;
	name: string | null;
	displayTitle: string;
	status: string;
	conclusion: string | null;
	event: string;
	headBranch: string | null;
	headSha: string;
	runNumber: number;
	runAttempt: number;
	runStartedAt: string | null;
	createdAt: string;
	updatedAt: string;
	htmlUrl: string;
	path: string;
	workflowId: number;
	actor: GitHubActor | null;
	triggeringActor: GitHubActor | null;
	pullRequests: WorkflowRunPullRequestRef[];
	viewerCanRerun: boolean;
};

export type WorkflowRunStep = {
	number: number;
	name: string;
	status: string;
	conclusion: string | null;
	startedAt: string | null;
	completedAt: string | null;
};

export type WorkflowRunJob = {
	id: number;
	runId: number;
	name: string;
	status: string;
	conclusion: string | null;
	startedAt: string | null;
	completedAt: string | null;
	htmlUrl: string | null;
	labels: string[];
	runnerName: string | null;
	steps: WorkflowRunStep[];
};

export type WorkflowRunArtifact = {
	id: number;
	name: string;
	sizeInBytes: number;
	expired: boolean;
	createdAt: string | null;
	expiresAt: string | null;
	archiveDownloadUrl: string;
	digest: string | null;
};

export type WorkflowJobLogs = {
	logs: string;
	fetchedAt: string;
	notAvailable: boolean;
};

/** Per-step logs derived from the run-level zip (`/actions/runs/{runId}/logs`).
 *  Keys are step numbers as they appear in the API job's `steps[].number`. */
export type WorkflowJobStepLogs = {
	/** Sanitized job name as it appears inside the zip (slash/colon stripped, 90-char UTF-16 truncated). */
	jobName: string;
	/** Whole-job log file from the top-level `{ordinal}_{jobName}.txt` entry, when present. */
	jobLog: string | null;
	/** Per-step files keyed by step number (e.g. `1` → contents of `<jobName>/1_<stepName>.txt`). */
	steps: Record<number, string>;
};

export type WorkflowRunLogsBundle = {
	jobs: Record<string, WorkflowJobStepLogs>;
	fetchedAt: string;
	notAvailable: boolean;
};

export type WorkflowDefinitionJob = {
	key: string;
	needs: string[];
	nameTemplate: string | null;
	isMatrix: boolean;
};

export type WorkflowDefinition = {
	jobs: WorkflowDefinitionJob[];
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
		expected: number;
	};
	checkRuns: PullCheckRun[];
	pendingWorkflowApprovals: PullWorkflowApproval[];
	mergeable: boolean | null;
	mergeableState: string | null;
	conflictingFiles: string[];
	behindBy: number | null;
	baseRefName: string;
	canUpdateBranch: boolean;
	canBypassProtections: boolean;
	canMerge: boolean;
	__meta?: GitHubLocalFirstMeta;
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
	__meta?: GitHubLocalFirstMeta;
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

export type PullFileSummariesPageInput = {
	owner: string;
	repo: string;
	pullNumber: number;
	cursor?: string | null;
};

export type PullFileSummariesPage = {
	items: PullFileSummary[];
	nextCursor: string | null;
};

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

export type RepoCommitInput = {
	owner: string;
	repo: string;
	sha: string;
};

export type RepoCommitDetail = {
	sha: string;
	message: string;
	date: string;
	author: GitHubActor | null;
	files: PullFile[];
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
	/** Whether the authenticated user has starred this repository */
	viewerHasStarred: boolean;
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
	/** Present when `isFork`; upstream `owner/name` */
	forkParentFullName: string | null;
	/** Upstream owner avatar from the same overview query (no extra request) */
	forkParentOwnerAvatarUrl: string | null;
	latestCommit: {
		sha: string;
		message: string;
		date: string;
		author: GitHubActor | null;
	} | null;
	__meta?: GitHubLocalFirstMeta;
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

export type BranchComparison = {
	aheadBy: number;
	behindBy: number;
	status: "ahead" | "behind" | "diverged" | "identical";
	totalCommits: number;
};

export type CompareFilesMeta = {
	/** True when the GitHub API capped the file list (max 300). */
	truncated: boolean;
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

export type GitHubLocalFirstMeta = {
	cacheStatus: "fresh" | "stale" | "miss";
	fetchedAt: number | null;
	isRevalidating: boolean;
};

export type NotificationsResult = {
	notifications: NotificationItem[];
	__meta?: GitHubLocalFirstMeta;
};
