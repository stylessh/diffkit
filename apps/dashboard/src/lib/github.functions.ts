/**
 * Compatibility barrel for "#/lib/github.functions".
 *
 * Modules under ./github/ that define server functions export only server
 * functions, types and client-safe helpers. TanStack Start strips handler
 * bodies from client and SSR-caller builds, but an exported helper survives
 * and drags its server-only imports (cloudflare:workers, D1) along. Shared
 * server code lives in helper modules that are imported only from handler
 * bodies: the request plumbing (client, installations, identity-memory,
 * request-dedup, mutations, mappers, shared, permissions) and the reads
 * behind one server function each (pull-status, pull-page-data, my-search,
 * notification-reads, reviewer-candidates, timeline, …).
 *
 * Keep the directory flat: the emulator's GraphQL document test reads every
 * module directly inside ./github/.
 */

export type {
	WorkflowDefinitionInput,
	WorkflowJobLogsInput,
	WorkflowRunInput,
	WorkflowRunListStatus,
	WorkflowRunLogsBundleInput,
	WorkflowRunsFromRepoInput,
} from "./github/actions";
export {
	getWorkflowDefinition,
	getWorkflowJobLogs,
	getWorkflowRun,
	getWorkflowRunLogsBundle,
	getWorkflowRunsForRepo,
	listWorkflowRunArtifacts,
	listWorkflowRunJobs,
	rerunFailedWorkflowJobs,
	rerunWorkflowRun,
	workflowZipJobName,
} from "./github/actions";
export { deduplicateCheckRuns, isFailedCheckRun } from "./github/check-runs";
export {
	getFileLastCommit,
	getRefHeadCommit,
	getRepoTree,
	getTreeEntryCommits,
} from "./github/code";
export type {
	CreateCommentInput,
	DeleteCommentInput,
	DeleteReviewCommentInput,
	EditCommentInput,
	EditReviewCommentInput,
	MinimizeCommentInput,
	ToggleIssueCommentReactionInput,
} from "./github/comments";
export {
	createComment,
	deleteComment,
	deleteReviewComment,
	editComment,
	editReviewComment,
	getCommentPage,
	getTimelineEventPage,
	minimizeComment,
	toggleIssueCommentReaction,
} from "./github/comments";
export {
	getRepoBranchesList,
	getRepoCommit,
	getRepoCommits,
	getRepoRefNames,
	getRepoTagsList,
	resolveRepoRefSplat,
} from "./github/commits";
export type {
	CreateIssueInput,
	CreateIssueResult,
	IssueFromRepoInput,
	IssuesFromRepoInput,
} from "./github/issues";
export {
	createIssue,
	getIssueComments,
	getIssueFromRepo,
	getIssuePageData,
	getIssuesFromRepo,
	updateIssueState,
} from "./github/issues";
export type { RepoLabelsInput, SaveRepoLabelInput } from "./github/labels";
export {
	createRepoLabel,
	deleteRepoLabel,
	getRepoLabels,
	saveRepoLabel,
	setIssueLabels,
} from "./github/labels";
export type { RepoMilestonesInput } from "./github/milestones";
export { getRepoMilestones } from "./github/milestones";
export {
	getNotifications,
	markAllNotificationsRead,
	markNotificationDone,
	markNotificationRead,
	unsubscribeNotification,
} from "./github/notifications";
export type {
	PullProductArea,
	PullProductAreasInput,
	RepoProductMapFile,
	RepoProductMapInput,
} from "./github/product-map";
export {
	getPullProductAreas,
	getRepoProductMapActivity,
	getRepoProductMapFile,
} from "./github/product-map";
export type {
	OpenPullForRefs,
	OpenPullForRefsInput,
} from "./github/pull-for-refs";
export { getOpenPullForRefs } from "./github/pull-for-refs";
export type {
	ApproveWorkflowRunsInput,
	ApproveWorkflowRunsResult,
	CreatePullRequestInput,
	CreatePullRequestResult,
	MergePullInput,
	PullsFromRepoInput,
	ReadyForReviewInput,
	RerunChecksInput,
	RerunChecksResult,
} from "./github/pulls";
export {
	approveWorkflowRuns,
	createPullRequest,
	deleteBranch,
	getPullComments,
	getPullFileSummaries,
	getPullFiles,
	getPullFromRepo,
	getPullPageData,
	getPullStatus,
	getPullsFromRepo,
	markPullReadyForReview,
	mergePullRequest,
	rerunChecks,
	updatePullBody,
	updatePullBranch,
	updatePullState,
} from "./github/pulls";
export { getCommitReference, getItemReference } from "./github/references";
export {
	createRepoRelease,
	deleteRepoRelease,
	generateRepoReleaseNotes,
	getRepoRelease,
	getRepoReleases,
	updateRepoRelease,
} from "./github/releases";
export type {
	CompareDetail,
	RecentPushableBranch,
} from "./github/repo-branches";
export {
	getBranchComparison,
	getCompareDetail,
	getRecentPushableBranch,
	getRepoBranches,
} from "./github/repo-branches";
export {
	getRepoContributors,
	getRepoDiscussions,
	getRepoParticipationStats,
} from "./github/repo-insights";
export {
	getRepoOverview,
	getRepoViewerPermission,
} from "./github/repo-overview";
export type { RepoTemplateKind } from "./github/repo-templates";
export { getRepoTemplate } from "./github/repo-templates";
export type {
	ForkRepoInput,
	ForkRepoResult,
	SetRepoStarredInput,
} from "./github/repos";
export {
	forkRepository,
	getProfileRepos,
	getReposHub,
	getUserRepos,
	setRepoStarred,
} from "./github/repos";
export type {
	OrgTeamsInput,
	RepoCollaboratorsInput,
} from "./github/review-requests";
export {
	getOrgTeams,
	getRepoCollaborators,
	removeReviewRequest,
	requestPullReviewers,
} from "./github/review-requests";
export type { DismissReviewInput, ResolveThreadInput } from "./github/reviews";
export {
	createReviewComment,
	dismissPullReview,
	getPullReviewComments,
	getReviewThreadStatuses,
	replyToReviewComment,
	resolveReviewThread,
	submitPullReview,
	unresolveReviewThread,
} from "./github/reviews";
export type {
	CommandPaletteSearchInput,
	IssuesFromUserInput,
	PullsFromUserInput,
} from "./github/search";
export {
	getIssuesFromUser,
	getMyIssues,
	getMyPulls,
	getPullsFromUser,
	searchCommandPaletteGitHub,
} from "./github/search";
export {
	getRepoAccess,
	removeRepoCollaborator,
	removeRepoTeam,
	setRepoCollaboratorRole,
	setRepoTeamRole,
} from "./github/settings-access";
export {
	deleteRepoActionsSecret,
	deleteRepoActionsVariable,
	getRepoActionsSecrets,
	getRepoActionsVariables,
	saveRepoActionsSecret,
	saveRepoActionsVariable,
} from "./github/settings-actions";
export type { ViewerOrg } from "./github/settings-org";
export {
	cancelOrgInvitation,
	deleteOrgTeam,
	getOrgMembers,
	getOrgSettings,
	getOrgTeamList,
	getOrgTeamMembers,
	getOrgViewerRole,
	getViewerOrganizations,
	inviteOrgMember,
	removeOrgMember,
	removeOrgTeamMember,
	saveOrgTeam,
	setOrgMemberRole,
	setOrgTeamMember,
	updateOrgSettings,
} from "./github/settings-org";
export {
	changeRepoVisibility,
	deleteRepository,
	getRepoGeneralSettings,
	setRepoArchived,
	updateRepoGeneralSettings,
} from "./github/settings-repo";
export {
	getRepoBranchProtections,
	getRepoRulesets,
} from "./github/settings-rules";
export {
	deleteRepoWebhook,
	getRepoWebhooks,
	getWebhookDeliveries,
	redeliverWebhookDelivery,
	saveRepoWebhook,
} from "./github/settings-webhooks";
export type { MutationResult, PullFromRepoInput } from "./github/shared";
export {
	getUserActivity,
	getUserContributions,
	getUserPinnedRepos,
	getUserProfile,
} from "./github/users";
export type { SerializedInstallationAccessIndex } from "./github/viewer";
export {
	checkSetupComplete,
	getGitHubAppAccessState,
	getGitHubViewer,
	getInstallationAccess,
} from "./github/viewer";
