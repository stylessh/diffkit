/**
 * Shapes for the declarative demo workspace in `content/`. Times are written
 * as offsets before the seed anchor (see `anchor.ts`) so the whole workspace
 * shifts together and stays reproducible.
 */

/** Days/hours/minutes before the anchor. */
export type Ago = { d: number; h?: number; m?: number };

/**
 * Bodies may reference other items with `#{issue:<key>}` or `#{pull:<head>}`
 * (same repo) and `{{viewer}}`; the seeder swaps in real numbers.
 */

/** `null` deletes the file. */
export type FileChanges = Record<string, string | null>;

export type CommitSpec = {
	message: string;
	author: string;
	at: Ago;
	files: FileChanges;
};

export type BranchSpec = {
	name: string;
	/** Branch to fork from; defaults to the repo's default branch. */
	from?: string;
	commits: CommitSpec[];
};

export type ReactionContent =
	| "THUMBS_UP"
	| "THUMBS_DOWN"
	| "LAUGH"
	| "HOORAY"
	| "CONFUSED"
	| "HEART"
	| "ROCKET"
	| "EYES";

export type Reactions = Partial<Record<ReactionContent, string[]>>;

export type CommentSpec = {
	author: string;
	body: string;
	at: Ago;
	reactions?: Reactions;
};

export type ReviewThreadSpec = {
	path: string;
	line: number;
	startLine?: number;
	side?: "LEFT" | "RIGHT";
	body: string;
	replies?: Array<{ author: string; body: string; at: Ago }>;
	resolved?: boolean;
};

export type ReviewSpec = {
	author: string;
	state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING";
	body?: string;
	at: Ago;
	threads?: ReviewThreadSpec[];
};

export type PullSpec = {
	head: string;
	base?: string;
	title: string;
	body: string;
	author: string;
	at: Ago;
	draft?: boolean;
	state?: "open" | "closed" | "merged";
	closedAt?: Ago;
	mergedBy?: string;
	labels?: string[];
	assignees?: string[];
	reviewers?: string[];
	reviews?: ReviewSpec[];
	comments?: CommentSpec[];
	reactions?: Reactions;
	/** Force GitHub's "This branch has conflicts" state. */
	conflicting?: boolean;
	milestone?: string;
};

export type IssueSpec = {
	/** Stable handle for `#{issue:<key>}` references in bodies. */
	key: string;
	title: string;
	body: string;
	author: string;
	at: Ago;
	labels?: string[];
	assignees?: string[];
	milestone?: string;
	state?: "open" | "closed";
	stateReason?: "completed" | "not_planned";
	closedAt?: Ago;
	comments?: CommentSpec[];
	reactions?: Reactions;
};

export type StepSpec = {
	name: string;
	conclusion?: "success" | "failure" | "skipped" | "cancelled" | null;
	log?: string[];
	seconds?: number;
};

export type JobSpec = {
	name: string;
	conclusion?: "success" | "failure" | "skipped" | "cancelled" | null;
	steps: StepSpec[];
};

export type WorkflowRunSpec = {
	workflow: string;
	/** Branch whose tip the run built. */
	branch: string;
	event: "push" | "pull_request" | "workflow_dispatch" | "release";
	at: Ago;
	status?: "completed" | "in_progress" | "queued";
	conclusion?: "success" | "failure" | "cancelled" | null;
	actor: string;
	jobs: JobSpec[];
	attempt?: number;
};

export type WorkflowSpec = {
	name: string;
	path: string;
};

export type TagSpec = {
	name: string;
	/** Commit index on the default branch history (`commits[]`). */
	commit: number;
	annotated?: { message: string; tagger: string; at: Ago };
};

export type ReleaseSpec = {
	tag: string;
	name: string;
	body: string;
	author: string;
	at: Ago;
	prerelease?: boolean;
	draft?: boolean;
	assets?: Array<{
		name: string;
		size: number;
		contentType: string;
		downloads: number;
	}>;
};

export type DiscussionSpec = {
	title: string;
	author: string;
	category: { name: string; emoji: string };
	at: Ago;
	updated: Ago;
	comments: number;
	answered?: Ago;
};

export type LabelSpec = { name: string; color: string; description?: string };

export type MilestoneSpec = {
	title: string;
	description?: string;
	dueIn?: number;
	state?: "open" | "closed";
};

export type RepoSpec = {
	owner: string;
	name: string;
	description: string;
	private?: boolean;
	language: string;
	languages?: Record<string, number>;
	topics?: string[];
	homepage?: string;
	license?: { key: string; name: string; spdx_id: string };
	stars: number;
	forks: number;
	watchers: number;
	hasDiscussions?: boolean;
	collaborators?: Array<{
		login: string;
		permission: "push" | "maintain" | "admin" | "triage";
	}>;
	/** Default branch history, oldest first. Index 0 is the root commit. */
	commits: CommitSpec[];
	branches?: BranchSpec[];
	labels?: LabelSpec[];
	milestones?: MilestoneSpec[];
	tags?: TagSpec[];
	releases?: ReleaseSpec[];
	pulls?: PullSpec[];
	issues?: IssueSpec[];
	workflows?: WorkflowSpec[];
	runs?: WorkflowRunSpec[];
	discussions?: DiscussionSpec[];
	/** Commit statuses (non-Actions CI) keyed by branch name. */
	statuses?: Array<{
		branch: string;
		context: string;
		state: "success" | "failure" | "pending" | "error";
		description: string;
		at: Ago;
	}>;
};

export type PersonSpec = {
	login: string;
	name: string;
	email: string;
	bio?: string;
	company?: string;
	location?: string;
	blog?: string;
	twitter?: string;
	followers?: number;
	following?: number;
};

export type NotificationSpec = {
	repo: string;
	/** `pull:<head>` or `issue:<title prefix>` */
	subject: string;
	reason: string;
	unread: boolean;
	at: Ago;
};

export type WorkspaceSpec = {
	people: PersonSpec[];
	org: {
		login: string;
		name: string;
		description: string;
		members: Array<{ login: string; role: "admin" | "member" }>;
		teams: Array<{
			name: string;
			slug: string;
			description: string;
			members: string[];
		}>;
	};
	repos: RepoSpec[];
	forks: Array<{ from: string; by: string }>;
	stars: Record<string, string[]>;
	pinned: Record<string, string[]>;
	notifications: NotificationSpec[];
};
