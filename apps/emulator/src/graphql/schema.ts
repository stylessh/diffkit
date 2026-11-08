/**
 * The slice of GitHub's GraphQL schema DiffKit's documents select. Names,
 * nullability and enums follow GitHub's public schema so the real query text
 * validates unchanged. Add fields here when DiffKit starts selecting them;
 * `graphql-documents.test.ts` fails until you do.
 */
export const typeDefs = /* GraphQL */ `
	scalar DateTime
	scalar Date
	scalar URI
	scalar GitObjectID
	scalar HTML

	type Query {
		repository(owner: String!, name: String!, followRenames: Boolean): Repository
		user(login: String!): User
		organization(login: String!): Organization
		viewer: User!
		node(id: ID!): Node
		search(
			type: SearchType!
			query: String!
			first: Int
			after: String
			last: Int
			before: String
		): SearchResultItemConnection!
		rateLimit(dryRun: Boolean): RateLimit
	}

	type Mutation {
		markPullRequestReadyForReview(
			input: MarkPullRequestReadyForReviewInput!
		): MarkPullRequestReadyForReviewPayload
		convertPullRequestToDraft(
			input: ConvertPullRequestToDraftInput!
		): ConvertPullRequestToDraftPayload
		resolveReviewThread(input: ResolveReviewThreadInput!): ResolveReviewThreadPayload
		unresolveReviewThread(
			input: UnresolveReviewThreadInput!
		): UnresolveReviewThreadPayload
		addReaction(input: AddReactionInput!): AddReactionPayload
		removeReaction(input: RemoveReactionInput!): RemoveReactionPayload
		minimizeComment(input: MinimizeCommentInput!): MinimizeCommentPayload
		unminimizeComment(input: UnminimizeCommentInput!): UnminimizeCommentPayload
	}

	type RateLimit {
		cost: Int!
		limit: Int!
		nodeCount: Int!
		remaining: Int!
		resetAt: DateTime!
		used: Int!
	}

	type PageInfo {
		hasNextPage: Boolean!
		hasPreviousPage: Boolean!
		startCursor: String
		endCursor: String
	}

	enum OrderDirection {
		ASC
		DESC
	}

	interface Node {
		id: ID!
	}

	interface Actor {
		login: String!
		avatarUrl(size: Int): URI!
		url: URI!
	}

	interface RepositoryOwner {
		id: ID!
		login: String!
		avatarUrl(size: Int): URI!
		url: URI!
	}

	interface Reactable {
		id: ID!
		reactions(
			first: Int
			after: String
			last: Int
			before: String
			content: ReactionContent
		): ReactionConnection!
	}

	interface Minimizable {
		isMinimized: Boolean!
		minimizedReason: String
	}

	interface GitObject {
		id: ID!
		oid: GitObjectID!
		abbreviatedOid: String!
		commitUrl: URI!
	}

	type User implements Node & Actor & RepositoryOwner {
		id: ID!
		databaseId: Int
		login: String!
		name: String
		email: String!
		bio: String
		company: String
		location: String
		avatarUrl(size: Int): URI!
		url: URI!
		createdAt: DateTime!
		contributionsCollection(
			from: DateTime
			to: DateTime
		): ContributionsCollection!
		pinnedItems(
			first: Int
			after: String
			last: Int
			before: String
			types: [PinnableItemType!]
		): PinnableItemConnection!
	}

	type Organization implements Node & Actor & RepositoryOwner {
		id: ID!
		databaseId: Int
		login: String!
		name: String
		description: String
		avatarUrl(size: Int): URI!
		url: URI!
	}

	type Bot implements Node & Actor {
		id: ID!
		login: String!
		avatarUrl(size: Int): URI!
		url: URI!
	}

	type Mannequin implements Node & Actor {
		id: ID!
		login: String!
		avatarUrl(size: Int): URI!
		url: URI!
	}

	type Team implements Node {
		id: ID!
		name: String!
		slug: String!
		combinedSlug: String!
		url: URI!
	}

	type UserConnection {
		nodes: [User]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type ContributionsCollection {
		contributionCalendar: ContributionCalendar!
		totalCommitContributions: Int!
		totalIssueContributions: Int!
		totalPullRequestContributions: Int!
		totalPullRequestReviewContributions: Int!
	}

	type ContributionCalendar {
		totalContributions: Int!
		colors: [String!]!
		isHalloween: Boolean!
		weeks: [ContributionCalendarWeek!]!
	}

	type ContributionCalendarWeek {
		firstDay: Date!
		contributionDays: [ContributionCalendarDay!]!
	}

	type ContributionCalendarDay {
		date: Date!
		weekday: Int!
		contributionCount: Int!
		contributionLevel: ContributionLevel!
		color: String!
	}

	enum ContributionLevel {
		NONE
		FIRST_QUARTILE
		SECOND_QUARTILE
		THIRD_QUARTILE
		FOURTH_QUARTILE
	}

	enum PinnableItemType {
		REPOSITORY
		GIST
		ISSUE
		PROJECT
		PULL_REQUEST
		USER
		ORGANIZATION
		TEAM
	}

	type Gist implements Node {
		id: ID!
		name: String!
		description: String
		url: URI!
	}

	union PinnableItem = Repository | Gist

	type PinnableItemConnection {
		nodes: [PinnableItem]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	enum RepositoryPermission {
		ADMIN
		MAINTAIN
		WRITE
		TRIAGE
		READ
	}

	type Repository implements Node {
		id: ID!
		databaseId: Int
		name: String!
		nameWithOwner: String!
		description: String
		url: URI!
		homepageUrl: URI
		isPrivate: Boolean!
		isFork: Boolean!
		isArchived: Boolean!
		isTemplate: Boolean!
		createdAt: DateTime!
		updatedAt: DateTime!
		pushedAt: DateTime
		owner: RepositoryOwner!
		parent: Repository
		viewerHasStarred: Boolean!
		viewerPermission: RepositoryPermission
		stargazerCount: Int!
		forkCount: Int!
		watchers(first: Int, after: String, last: Int, before: String): UserConnection!
		primaryLanguage: Language
		licenseInfo: License
		repositoryTopics(
			first: Int
			after: String
			last: Int
			before: String
		): RepositoryTopicConnection!
		hasIssuesEnabled: Boolean!
		hasDiscussionsEnabled: Boolean!
		defaultBranchRef: Ref
		ref(qualifiedName: String!): Ref
		refs(
			refPrefix: String!
			first: Int
			after: String
			last: Int
			before: String
			query: String
			direction: OrderDirection
			orderBy: RefOrder
		): RefConnection
		object(expression: String, oid: GitObjectID): GitObject
		issue(number: Int!): Issue
		pullRequest(number: Int!): PullRequest
		issueOrPullRequest(number: Int!): IssueOrPullRequest
		issues(
			first: Int
			after: String
			last: Int
			before: String
			states: [IssueState!]
			labels: [String!]
			orderBy: IssueOrder
		): IssueConnection!
		pullRequests(
			first: Int
			after: String
			last: Int
			before: String
			states: [PullRequestState!]
			labels: [String!]
			headRefName: String
			baseRefName: String
			orderBy: IssueOrder
		): PullRequestConnection!
		discussions(
			first: Int
			after: String
			last: Int
			before: String
			orderBy: DiscussionOrder
			answered: Boolean
		): DiscussionConnection!
	}

	type Language implements Node {
		id: ID!
		name: String!
		color: String
	}

	type License implements Node {
		id: ID!
		key: String!
		name: String!
		spdxId: String
	}

	type Topic implements Node {
		id: ID!
		name: String!
	}

	type RepositoryTopic implements Node {
		id: ID!
		topic: Topic!
		url: URI!
	}

	type RepositoryTopicConnection {
		nodes: [RepositoryTopic]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	enum RefOrderField {
		TAG_COMMIT_DATE
		ALPHABETICAL
	}

	input RefOrder {
		field: RefOrderField!
		direction: OrderDirection!
	}

	type Ref implements Node {
		id: ID!
		name: String!
		prefix: String!
		target: GitObject
		associatedPullRequests(
			first: Int
			after: String
			last: Int
			before: String
			states: [PullRequestState!]
			orderBy: IssueOrder
		): PullRequestConnection!
	}

	type RefConnection {
		nodes: [Ref]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type GitActor {
		name: String
		email: String
		date: DateTime
		avatarUrl(size: Int): URI!
		user: User
	}

	type Commit implements Node & GitObject {
		id: ID!
		oid: GitObjectID!
		abbreviatedOid: String!
		commitUrl: URI!
		url: URI!
		message: String!
		messageHeadline: String!
		messageBody: String!
		committedDate: DateTime!
		authoredDate: DateTime!
		author: GitActor
		committer: GitActor
		tree: Tree!
		history(
			first: Int
			after: String
			last: Int
			before: String
			path: String
		): CommitHistoryConnection!
	}

	type CommitHistoryConnection {
		nodes: [Commit]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type Tree implements Node & GitObject {
		id: ID!
		oid: GitObjectID!
		abbreviatedOid: String!
		commitUrl: URI!
	}

	type Blob implements Node & GitObject {
		id: ID!
		oid: GitObjectID!
		abbreviatedOid: String!
		commitUrl: URI!
		byteSize: Int!
		isBinary: Boolean
		isTruncated: Boolean!
		text: String
	}

	type Tag implements Node & GitObject {
		id: ID!
		oid: GitObjectID!
		abbreviatedOid: String!
		commitUrl: URI!
		name: String!
		message: String
		tagger: GitActor
		target: GitObject!
	}

	enum ReactionContent {
		THUMBS_UP
		THUMBS_DOWN
		LAUGH
		HOORAY
		CONFUSED
		HEART
		ROCKET
		EYES
	}

	type Reaction implements Node {
		id: ID!
		databaseId: Int
		content: ReactionContent!
		createdAt: DateTime!
		user: User
	}

	type ReactionConnection {
		nodes: [Reaction]
		totalCount: Int!
		viewerHasReacted: Boolean!
		pageInfo: PageInfo!
	}

	type Label implements Node {
		id: ID!
		name: String!
		color: String!
		description: String
	}

	type LabelConnection {
		nodes: [Label]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type Milestone implements Node {
		id: ID!
		number: Int!
		title: String!
		description: String
		dueOn: DateTime
		state: MilestoneState!
		url: URI!
	}

	enum MilestoneState {
		OPEN
		CLOSED
	}

	type IssueComment implements Node & Reactable & Minimizable {
		id: ID!
		databaseId: Int
		body: String!
		bodyText: String!
		createdAt: DateTime!
		updatedAt: DateTime!
		lastEditedAt: DateTime
		author: Actor
		url: URI!
		isMinimized: Boolean!
		minimizedReason: String
		reactions(
			first: Int
			after: String
			last: Int
			before: String
			content: ReactionContent
		): ReactionConnection!
	}

	type IssueCommentConnection {
		nodes: [IssueComment]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	enum IssueState {
		OPEN
		CLOSED
	}

	enum IssueStateReason {
		COMPLETED
		NOT_PLANNED
		REOPENED
		DUPLICATE
	}

	enum IssueOrderField {
		CREATED_AT
		UPDATED_AT
		COMMENTS
	}

	input IssueOrder {
		field: IssueOrderField!
		direction: OrderDirection!
	}

	enum IssueTimelineItemsItemType {
		CROSS_REFERENCED_EVENT
		ISSUE_COMMENT
		LABELED_EVENT
		CLOSED_EVENT
		REFERENCED_EVENT
	}

	enum PullRequestTimelineItemsItemType {
		CROSS_REFERENCED_EVENT
		ISSUE_COMMENT
		LABELED_EVENT
		CLOSED_EVENT
		MERGED_EVENT
		REFERENCED_EVENT
		PULL_REQUEST_REVIEW
	}

	union ReferencedSubject = Issue | PullRequest
	union IssueOrPullRequest = Issue | PullRequest

	type CrossReferencedEvent implements Node {
		id: ID!
		actor: Actor
		createdAt: DateTime!
		isCrossRepository: Boolean!
		willCloseTarget: Boolean!
		source: ReferencedSubject!
		target: ReferencedSubject!
	}

	union IssueTimelineItems = CrossReferencedEvent
	union PullRequestTimelineItems = CrossReferencedEvent

	type IssueTimelineItemsConnection {
		nodes: [IssueTimelineItems]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PullRequestTimelineItemsConnection {
		nodes: [PullRequestTimelineItems]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type Issue implements Node & Reactable {
		id: ID!
		databaseId: Int
		number: Int!
		title: String!
		body: String!
		state: IssueState!
		stateReason: IssueStateReason
		createdAt: DateTime!
		updatedAt: DateTime!
		closedAt: DateTime
		url: URI!
		author: Actor
		repository: Repository!
		milestone: Milestone
		labels(first: Int, after: String, last: Int, before: String): LabelConnection
		assignees(
			first: Int
			after: String
			last: Int
			before: String
		): UserConnection!
		comments(
			first: Int
			after: String
			last: Int
			before: String
		): IssueCommentConnection!
		reactions(
			first: Int
			after: String
			last: Int
			before: String
			content: ReactionContent
		): ReactionConnection!
		timelineItems(
			first: Int
			after: String
			last: Int
			before: String
			itemTypes: [IssueTimelineItemsItemType!]
		): IssueTimelineItemsConnection!
	}

	type IssueConnection {
		nodes: [Issue]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	enum PullRequestState {
		OPEN
		CLOSED
		MERGED
	}

	enum MergeableState {
		MERGEABLE
		CONFLICTING
		UNKNOWN
	}

	enum MergeStateStatus {
		BEHIND
		BLOCKED
		CLEAN
		DIRTY
		DRAFT
		HAS_HOOKS
		UNKNOWN
		UNSTABLE
	}

	enum PatchStatus {
		ADDED
		DELETED
		RENAMED
		COPIED
		MODIFIED
		CHANGED
	}

	enum DiffSide {
		LEFT
		RIGHT
	}

	enum PullRequestReviewThreadSubjectType {
		LINE
		FILE
	}

	enum PullRequestReviewState {
		PENDING
		COMMENTED
		APPROVED
		CHANGES_REQUESTED
		DISMISSED
	}

	union RequestedReviewer = User | Team | Bot | Mannequin

	type ReviewRequest implements Node {
		id: ID!
		requestedReviewer: RequestedReviewer
	}

	type ReviewRequestConnection {
		nodes: [ReviewRequest]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PullRequestCommit implements Node {
		id: ID!
		commit: Commit!
	}

	type PullRequestCommitConnection {
		nodes: [PullRequestCommit]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PullRequestChangedFile {
		path: String!
		additions: Int!
		deletions: Int!
		changeType: PatchStatus!
	}

	type PullRequestChangedFileConnection {
		nodes: [PullRequestChangedFile]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PullRequestReviewComment implements Node & Reactable & Minimizable {
		id: ID!
		databaseId: Int
		body: String!
		path: String!
		line: Int
		startLine: Int
		originalLine: Int
		diffHunk: String!
		subjectType: PullRequestReviewThreadSubjectType!
		outdated: Boolean!
		createdAt: DateTime!
		updatedAt: DateTime!
		author: Actor
		url: URI!
		isMinimized: Boolean!
		minimizedReason: String
		reactions(
			first: Int
			after: String
			last: Int
			before: String
			content: ReactionContent
		): ReactionConnection!
	}

	type PullRequestReviewCommentConnection {
		nodes: [PullRequestReviewComment]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PullRequestReviewThread implements Node {
		id: ID!
		isResolved: Boolean!
		isOutdated: Boolean!
		path: String!
		line: Int
		startLine: Int
		diffSide: DiffSide!
		subjectType: PullRequestReviewThreadSubjectType!
		resolvedBy: User
		comments(
			first: Int
			after: String
			last: Int
			before: String
		): PullRequestReviewCommentConnection!
	}

	type PullRequestReviewThreadConnection {
		nodes: [PullRequestReviewThread]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PullRequestReview implements Node {
		id: ID!
		databaseId: Int
		body: String!
		url: URI!
		state: PullRequestReviewState!
		createdAt: DateTime!
		updatedAt: DateTime!
		submittedAt: DateTime
		author: Actor
		comments(
			first: Int
			after: String
			last: Int
			before: String
		): PullRequestReviewCommentConnection!
	}

	type PullRequestReviewConnection {
		nodes: [PullRequestReview]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PullRequest implements Node & Reactable {
		id: ID!
		databaseId: Int
		number: Int!
		title: String!
		body: String!
		state: PullRequestState!
		isDraft: Boolean!
		createdAt: DateTime!
		updatedAt: DateTime!
		closedAt: DateTime
		mergedAt: DateTime
		url: URI!
		additions: Int!
		deletions: Int!
		changedFiles: Int!
		author: Actor
		repository: Repository!
		headRefName: String!
		headRefOid: GitObjectID!
		headRepository: Repository
		headRepositoryOwner: RepositoryOwner
		baseRefName: String!
		baseRefOid: GitObjectID!
		merged: Boolean!
		mergeCommit: Commit
		mergedBy: Actor
		mergeable: MergeableState!
		mergeStateStatus: MergeStateStatus!
		milestone: Milestone
		labels(first: Int, after: String, last: Int, before: String): LabelConnection
		assignees(
			first: Int
			after: String
			last: Int
			before: String
		): UserConnection!
		comments(
			first: Int
			after: String
			last: Int
			before: String
		): IssueCommentConnection!
		reactions(
			first: Int
			after: String
			last: Int
			before: String
			content: ReactionContent
		): ReactionConnection!
		reviewRequests(
			first: Int
			after: String
			last: Int
			before: String
		): ReviewRequestConnection
		reviewThreads(
			first: Int
			after: String
			last: Int
			before: String
		): PullRequestReviewThreadConnection!
		reviews(
			first: Int
			after: String
			last: Int
			before: String
			states: [PullRequestReviewState!]
			author: String
		): PullRequestReviewConnection
		commits(
			first: Int
			after: String
			last: Int
			before: String
		): PullRequestCommitConnection!
		files(
			first: Int
			after: String
			last: Int
			before: String
		): PullRequestChangedFileConnection
		timelineItems(
			first: Int
			after: String
			last: Int
			before: String
			itemTypes: [PullRequestTimelineItemsItemType!]
		): PullRequestTimelineItemsConnection!
	}

	type PullRequestConnection {
		nodes: [PullRequest]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	enum DiscussionOrderField {
		CREATED_AT
		UPDATED_AT
	}

	input DiscussionOrder {
		field: DiscussionOrderField!
		direction: OrderDirection!
	}

	type DiscussionCategory implements Node {
		id: ID!
		name: String!
		emoji: String!
		emojiHTML: HTML!
	}

	type DiscussionCommentConnection {
		totalCount: Int!
	}

	type Discussion implements Node {
		id: ID!
		number: Int!
		title: String!
		createdAt: DateTime!
		updatedAt: DateTime!
		author: Actor
		category: DiscussionCategory!
		comments(first: Int, after: String): DiscussionCommentConnection!
		answerChosenAt: DateTime
		url: URI!
	}

	type DiscussionConnection {
		nodes: [Discussion]
		totalCount: Int!
		pageInfo: PageInfo!
	}

	enum SearchType {
		ISSUE
		ISSUE_ADVANCED
		REPOSITORY
		USER
		DISCUSSION
	}

	union SearchResultItem = Issue | PullRequest | Repository | User | Organization

	type SearchResultItemConnection {
		nodes: [SearchResultItem]
		issueCount: Int!
		repositoryCount: Int!
		userCount: Int!
		discussionCount: Int!
		pageInfo: PageInfo!
	}

	enum ReportedContentClassifiers {
		SPAM
		ABUSE
		OFF_TOPIC
		OUTDATED
		DUPLICATE
		RESOLVED
	}

	input MarkPullRequestReadyForReviewInput {
		pullRequestId: ID!
		clientMutationId: String
	}

	type MarkPullRequestReadyForReviewPayload {
		clientMutationId: String
		pullRequest: PullRequest
	}

	input ConvertPullRequestToDraftInput {
		pullRequestId: ID!
		clientMutationId: String
	}

	type ConvertPullRequestToDraftPayload {
		clientMutationId: String
		pullRequest: PullRequest
	}

	input ResolveReviewThreadInput {
		threadId: ID!
		clientMutationId: String
	}

	type ResolveReviewThreadPayload {
		clientMutationId: String
		thread: PullRequestReviewThread
	}

	input UnresolveReviewThreadInput {
		threadId: ID!
		clientMutationId: String
	}

	type UnresolveReviewThreadPayload {
		clientMutationId: String
		thread: PullRequestReviewThread
	}

	input AddReactionInput {
		subjectId: ID!
		content: ReactionContent!
		clientMutationId: String
	}

	type AddReactionPayload {
		clientMutationId: String
		reaction: Reaction
		subject: Reactable
	}

	input RemoveReactionInput {
		subjectId: ID!
		content: ReactionContent!
		clientMutationId: String
	}

	type RemoveReactionPayload {
		clientMutationId: String
		reaction: Reaction
		subject: Reactable
	}

	input MinimizeCommentInput {
		subjectId: ID!
		classifier: ReportedContentClassifiers!
		clientMutationId: String
	}

	type MinimizeCommentPayload {
		clientMutationId: String
		minimizedComment: Minimizable
	}

	input UnminimizeCommentInput {
		subjectId: ID!
		clientMutationId: String
	}

	type UnminimizeCommentPayload {
		clientMutationId: String
		unminimizedComment: Minimizable
	}
`;
