/**
 * Resolvers for the GraphQL shim. Parents are small tagged models
 * (`{ __typename, ...rows }`) around emulate's store rows.
 */
import type { AuthUser } from "@emulators/core";
import type {
	GitHubComment,
	GitHubCommit,
	GitHubIssue,
	GitHubOrg,
	GitHubPullRequest,
	GitHubRepo,
	GitHubReview,
	GitHubStore,
	GitHubTag,
	GitHubTeam,
	GitHubUser,
} from "@emulators/github";
import { GraphQLError } from "graphql";
import type { ShimContext } from "../server.ts";
import {
	canReadRepo,
	GITHUB_WEB_URL,
	hashString,
	ownerLogin,
	stores,
} from "../shims/common.ts";
import { decodeNodeId, encodeNodeId } from "../shims/enrich.ts";
import { searchIssues } from "../shims/search.ts";
import type {
	DiscussionRow,
	ExtrasStore,
	ReactionRow,
	ReactionSubjectType,
} from "../store-extras.ts";
import {
	type ConnectionArgs,
	commitsBetween,
	connection,
	findCommit,
	historyForPath,
	lookupPath,
	resolveRevision,
} from "./git.ts";

export type GraphQLContext = {
	shim: ShimContext;
	gh: GitHubStore;
	extras: ExtrasStore;
	auth: AuthUser | undefined;
	viewer: GitHubUser | null;
	authorization: string;
	fileCache: Map<string, Promise<RestFile[]>>;
};

type RestFile = {
	filename: string;
	status: string;
	additions: number;
	deletions: number;
};

type UserModel = { __typename: "User"; user: GitHubUser };
type OrgModel = { __typename: "Organization"; org: GitHubOrg };
type RepoModel = { __typename: "Repository"; repo: GitHubRepo };
type IssueModel = { __typename: "Issue"; issue: GitHubIssue; repo: GitHubRepo };
type PullModel = {
	__typename: "PullRequest";
	pull: GitHubPullRequest;
	issue: GitHubIssue;
	repo: GitHubRepo;
};
type CommitModel = {
	__typename: "Commit";
	commit: GitHubCommit;
	repo: GitHubRepo;
};
type TreeModel = { __typename: "Tree"; sha: string; repo: GitHubRepo };
type BlobModel = { __typename: "Blob"; sha: string; repo: GitHubRepo };
type TagModel = { __typename: "Tag"; tag: GitHubTag; repo: GitHubRepo };
type GitObjectModel = CommitModel | TreeModel | BlobModel | TagModel;
type RefModel = {
	__typename: "Ref";
	repo: GitHubRepo;
	name: string;
	prefix: string;
	sha: string;
};
type IssueCommentModel = {
	__typename: "IssueComment";
	comment: GitHubComment;
	repo: GitHubRepo;
};
type ReviewCommentModel = {
	__typename: "PullRequestReviewComment";
	comment: GitHubComment;
	repo: GitHubRepo;
};
type ThreadModel = {
	__typename: "PullRequestReviewThread";
	root: GitHubComment;
	comments: GitHubComment[];
	repo: GitHubRepo;
};
type ReviewModel = {
	__typename: "PullRequestReview";
	review: GitHubReview;
	repo: GitHubRepo;
};
type TeamModel = {
	__typename: "Team";
	team: GitHubTeam;
	org: GitHubOrg | undefined;
};
type CrossReferenceModel = {
	__typename: "CrossReferencedEvent";
	id: string;
	actorId: number;
	createdAt: string;
	source: IssueModel | PullModel;
	target: IssueModel | PullModel;
};
type DiscussionModel = {
	__typename: "Discussion";
	discussion: DiscussionRow;
	repo: GitHubRepo;
};

type Args = Record<string, unknown> & ConnectionArgs;

const LANGUAGE_COLORS: Record<string, string> = {
	TypeScript: "#3178c6",
	JavaScript: "#f1e05a",
	Markdown: "#083fa1",
	MDX: "#fcb32c",
	HCL: "#844fba",
	Shell: "#89e051",
	Go: "#00ADD8",
	CSS: "#663399",
};

const CONTRIBUTION_COLORS = [
	"#ebedf0",
	"#9be9a8",
	"#40c463",
	"#30a14e",
	"#216e39",
];
const CONTRIBUTION_LEVELS = [
	"NONE",
	"FIRST_QUARTILE",
	"SECOND_QUARTILE",
	"THIRD_QUARTILE",
	"FOURTH_QUARTILE",
] as const;

function notFoundError(message: string) {
	return new GraphQLError(message, { extensions: { type: "NOT_FOUND" } });
}

function webUrl(path: string) {
	return `${GITHUB_WEB_URL}/${path}`;
}

function avatarUrl(ctx: GraphQLContext, login: string) {
	return `${ctx.shim.baseUrl}/avatars/u/${login}`;
}

function userModel(user: GitHubUser | undefined | null): UserModel | null {
	return user ? { __typename: "User", user } : null;
}

function actorById(ctx: GraphQLContext, userId: number | null | undefined) {
	return userId ? userModel(ctx.gh.users.get(userId)) : null;
}

function ownerModel(
	ctx: GraphQLContext,
	repo: GitHubRepo,
): UserModel | OrgModel | null {
	if (repo.owner_type === "Organization") {
		const org = ctx.gh.orgs.get(repo.owner_id);
		return org ? { __typename: "Organization", org } : null;
	}
	return userModel(ctx.gh.users.get(repo.owner_id));
}

function findIssueRow(gh: GitHubStore, repoId: number, number: number) {
	return gh.issues
		.findBy("repo_id", repoId)
		.find((row) => row.number === number);
}

function findPullRow(gh: GitHubStore, repoId: number, number: number) {
	return gh.pullRequests
		.findBy("repo_id", repoId)
		.find((row) => row.number === number);
}

function issueOrPullModel(
	ctx: GraphQLContext,
	repo: GitHubRepo,
	number: number,
): IssueModel | PullModel | null {
	const issue = findIssueRow(ctx.gh, repo.id, number);
	const pull = findPullRow(ctx.gh, repo.id, number);
	if (pull) {
		const issueRow =
			issue ??
			({
				id: 0,
				number,
				repo_id: repo.id,
				label_ids: [],
				assignee_ids: [],
			} as unknown as GitHubIssue);
		return { __typename: "PullRequest", pull, issue: issueRow, repo };
	}
	return issue ? { __typename: "Issue", issue, repo } : null;
}

function visibleRepo(ctx: GraphQLContext, owner: string, name: string) {
	const repo =
		ctx.gh.repos.findOneBy("full_name", `${owner}/${name}`) ??
		ctx.gh.repos
			.all()
			.find(
				(row) =>
					row.full_name.toLowerCase() === `${owner}/${name}`.toLowerCase(),
			);
	return repo && canReadRepo(ctx.gh, ctx.auth, repo) ? repo : null;
}

function byCreated<T extends { created_at: string; id: number }>(a: T, b: T) {
	return a.created_at.localeCompare(b.created_at) || a.id - b.id;
}

function issueComments(ctx: GraphQLContext, repo: GitHubRepo, number: number) {
	return ctx.gh.comments
		.findBy("repo_id", repo.id)
		.filter(
			(row) => row.comment_type === "issue" && row.issue_number === number,
		)
		.sort(byCreated);
}

function pendingReviewIdsHiddenFrom(ctx: GraphQLContext, repo: GitHubRepo) {
	return new Set(
		ctx.gh.reviews
			.findBy("repo_id", repo.id)
			.filter(
				(review) =>
					review.state === "PENDING" && review.user_id !== ctx.viewer?.id,
			)
			.map((review) => review.id),
	);
}

function reviewComments(ctx: GraphQLContext, repo: GitHubRepo, number: number) {
	const hidden = pendingReviewIdsHiddenFrom(ctx, repo);
	return ctx.gh.comments
		.findBy("repo_id", repo.id)
		.filter(
			(row) =>
				row.comment_type === "review" &&
				row.pull_number === number &&
				!(row.review_id !== null && hidden.has(row.review_id)),
		)
		.sort(byCreated);
}

function threadsFor(
	ctx: GraphQLContext,
	repo: GitHubRepo,
	number: number,
): ThreadModel[] {
	const comments = reviewComments(ctx, repo, number);
	const byId = new Map(comments.map((comment) => [comment.id, comment]));
	const rootOf = (comment: GitHubComment): GitHubComment => {
		let current = comment;
		const seen = new Set<number>();
		while (
			current.in_reply_to_id &&
			byId.has(current.in_reply_to_id) &&
			!seen.has(current.id)
		) {
			seen.add(current.id);
			current = byId.get(current.in_reply_to_id) as GitHubComment;
		}
		return current;
	};
	const threads = new Map<number, ThreadModel>();
	for (const comment of comments) {
		const root = rootOf(comment);
		const thread =
			threads.get(root.id) ??
			({
				__typename: "PullRequestReviewThread",
				root,
				comments: [],
				repo,
			} as ThreadModel);
		thread.comments.push(comment);
		threads.set(root.id, thread);
	}
	return [...threads.values()].sort((a, b) => byCreated(a.root, b.root));
}

function reactionSubject(model: {
	__typename: string;
	issue?: GitHubIssue;
	comment?: GitHubComment;
}): {
	subject_type: ReactionSubjectType;
	subject_id: number;
} | null {
	if (model.__typename === "Issue" || model.__typename === "PullRequest") {
		return model.issue?.id
			? { subject_type: "issue", subject_id: model.issue.id }
			: null;
	}
	if (model.__typename === "IssueComment" && model.comment) {
		return { subject_type: "issue_comment", subject_id: model.comment.id };
	}
	if (model.__typename === "PullRequestReviewComment" && model.comment) {
		return { subject_type: "review_comment", subject_id: model.comment.id };
	}
	return null;
}

function reactionsConnection(
	ctx: GraphQLContext,
	model: { __typename: string; issue?: GitHubIssue; comment?: GitHubComment },
	args: Args,
) {
	const subject = reactionSubject(model);
	const rows = subject
		? ctx.extras.reactions
				.findBy("subject_id", subject.subject_id)
				.filter(
					(row) =>
						row.subject_type === subject.subject_type &&
						(!args.content || row.content === args.content),
				)
				.sort((a, b) => a.id - b.id)
		: [];
	return {
		...connection(rows, args),
		viewerHasReacted: rows.some((row) => row.user_id === ctx.viewer?.id),
	};
}

/** Issues/PRs whose body or comments mention `target` (`#12`, `owner/repo#12`, URLs). */
function crossReferences(
	ctx: GraphQLContext,
	target: IssueModel | PullModel,
): CrossReferenceModel[] {
	const targetNumber =
		target.__typename === "PullRequest"
			? target.pull.number
			: target.issue.number;
	const fullName = target.repo.full_name.toLowerCase();
	const patterns = [
		new RegExp(`(^|[^\\w/#])#${targetNumber}\\b`, "u"),
		new RegExp(
			`${fullName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}#${targetNumber}\\b`,
			"iu",
		),
		new RegExp(
			`github\\.com/${fullName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/(issues|pull)/${targetNumber}\\b`,
			"iu",
		),
	];
	const mentions = (text: string | null, sameRepo: boolean) =>
		Boolean(text) &&
		(patterns[1].test(text as string) ||
			patterns[2].test(text as string) ||
			(sameRepo && patterns[0].test(text as string)));

	const refs = new Map<string, CrossReferenceModel>();
	for (const issue of ctx.gh.issues.all()) {
		const repo = ctx.gh.repos.get(issue.repo_id);
		if (!repo || !canReadRepo(ctx.gh, ctx.auth, repo)) continue;
		if (repo.id === target.repo.id && issue.number === targetNumber) continue;
		const sameRepo = repo.id === target.repo.id;
		const candidates: Array<{
			actorId: number;
			at: string;
			text: string | null;
		}> = [
			{
				actorId: issue.user_id,
				at: issue.created_at,
				text: `${issue.title}\n${issue.body ?? ""}`,
			},
			...issueComments(ctx, repo, issue.number).map((comment) => ({
				actorId: comment.user_id,
				at: comment.created_at,
				text: comment.body,
			})),
		];
		const hit = candidates.find((candidate) =>
			mentions(candidate.text, sameRepo),
		);
		if (!hit) continue;
		const source = issueOrPullModel(ctx, repo, issue.number);
		if (!source) continue;
		refs.set(`${repo.id}#${issue.number}`, {
			__typename: "CrossReferencedEvent",
			id: encodeNodeId("CrossReferencedEvent", issue.id * 1000 + targetNumber),
			actorId: hit.actorId,
			createdAt: hit.at,
			source,
			target,
		});
	}
	return [...refs.values()].sort((a, b) =>
		a.createdAt.localeCompare(b.createdAt),
	);
}

function pullFiles(ctx: GraphQLContext, model: PullModel) {
	const key = `${model.repo.id}#${model.pull.number}`;
	let pending = ctx.fileCache.get(key);
	if (!pending) {
		pending = (async () => {
			const files: RestFile[] = [];
			for (let page = 1; page < 50; page++) {
				const response = await ctx.shim.internalFetch(
					`/repos/${model.repo.full_name}/pulls/${model.pull.number}/files?per_page=100&page=${page}`,
					{ headers: { Authorization: ctx.authorization } },
				);
				if (!response.ok) break;
				const batch = (await response.json()) as RestFile[];
				files.push(...batch);
				if (batch.length < 100) break;
			}
			return files;
		})();
		ctx.fileCache.set(key, pending);
	}
	return pending;
}

const CHANGE_TYPES: Record<string, string> = {
	added: "ADDED",
	removed: "DELETED",
	modified: "MODIFIED",
	renamed: "RENAMED",
	copied: "COPIED",
	changed: "CHANGED",
};

function viewerPermission(ctx: GraphQLContext, repo: GitHubRepo) {
	const viewer = ctx.viewer;
	if (!viewer) return null;
	if (viewer.site_admin) return "ADMIN";
	if (repo.owner_type === "User") {
		if (repo.owner_id === viewer.id) return "ADMIN";
	} else {
		const memberships = ctx.gh.teams
			.findBy("org_id", repo.owner_id)
			.flatMap((team) => ctx.gh.teamMembers.findBy("team_id", team.id))
			.filter((member) => member.user_id === viewer.id);
		if (memberships.some((member) => member.role === "maintainer"))
			return "ADMIN";
		if (memberships.length > 0) return "WRITE";
	}
	const collaborator = ctx.gh.collaborators
		.findBy("repo_id", repo.id)
		.find((row) => row.user_id === viewer.id);
	if (collaborator) {
		return (
			{
				admin: "ADMIN",
				maintain: "MAINTAIN",
				push: "WRITE",
				triage: "TRIAGE",
				pull: "READ",
			} as const
		)[collaborator.permission];
	}
	return repo.private ? null : "READ";
}

function gitObject(
	ctx: GraphQLContext,
	repo: GitHubRepo,
	sha: string,
): GitObjectModel | null {
	const commit = findCommit(ctx.gh, repo.id, sha);
	if (commit) return { __typename: "Commit", commit, repo };
	const tag = ctx.gh.tags
		.findBy("repo_id", repo.id)
		.find((row) => row.sha === sha);
	if (tag) return { __typename: "Tag", tag, repo };
	if (ctx.gh.trees.findBy("repo_id", repo.id).some((row) => row.sha === sha)) {
		return { __typename: "Tree", sha, repo };
	}
	if (ctx.gh.blobs.findBy("repo_id", repo.id).some((row) => row.sha === sha)) {
		return { __typename: "Blob", sha, repo };
	}
	return null;
}

function refsFor(
	ctx: GraphQLContext,
	repo: GitHubRepo,
	prefix: string,
): RefModel[] {
	if (prefix === "refs/heads/") {
		return ctx.gh.branches.findBy("repo_id", repo.id).map((branch) => ({
			__typename: "Ref" as const,
			repo,
			name: branch.name,
			prefix,
			sha: branch.sha,
		}));
	}
	return ctx.gh.refs
		.findBy("repo_id", repo.id)
		.filter((ref) => ref.ref.startsWith(prefix))
		.map((ref) => ({
			__typename: "Ref" as const,
			repo,
			name: ref.ref.slice(prefix.length),
			prefix,
			sha: ref.sha,
		}));
}

function refTargetDate(ctx: GraphQLContext, ref: RefModel) {
	const object = gitObject(ctx, ref.repo, ref.sha);
	if (object?.__typename === "Commit") return object.commit.committer_date;
	if (object?.__typename === "Tag") {
		return (
			findCommit(ctx.gh, ref.repo.id, object.tag.object_sha)?.committer_date ??
			object.tag.tagger_date
		);
	}
	return "";
}

function pullState(pull: GitHubPullRequest) {
	if (pull.merged) return "MERGED";
	return pull.state === "open" ? "OPEN" : "CLOSED";
}

function filterByStates<T extends PullModel | IssueModel>(
	models: T[],
	states: unknown,
) {
	if (!Array.isArray(states) || states.length === 0) return models;
	return models.filter((model) =>
		states.includes(
			model.__typename === "PullRequest"
				? pullState(model.pull)
				: model.issue.state.toUpperCase(),
		),
	);
}

function sortByOrder<
	T extends { created_at: string; updated_at: string; id: number },
>(rows: T[], orderBy: unknown) {
	const order = (orderBy ?? { field: "CREATED_AT", direction: "ASC" }) as {
		field: string;
		direction: string;
	};
	const key = order.field === "UPDATED_AT" ? "updated_at" : "created_at";
	const sign = order.direction === "DESC" ? -1 : 1;
	return [...rows].sort(
		(a, b) => sign * (a[key].localeCompare(b[key]) || a.id - b.id),
	);
}

function pullModelsFor(ctx: GraphQLContext, repo: GitHubRepo) {
	return ctx.gh.pullRequests
		.findBy("repo_id", repo.id)
		.map((pull) => issueOrPullModel(ctx, repo, pull.number))
		.filter((model): model is PullModel => model?.__typename === "PullRequest");
}

function gitActor(
	ctx: GraphQLContext,
	name: string,
	email: string,
	date: string,
	userId: number | null,
) {
	const user =
		(userId ? ctx.gh.users.get(userId) : undefined) ??
		ctx.gh.users.all().find((row) => row.email && row.email === email);
	return {
		name,
		email,
		date,
		user: userModel(user),
		login: user?.login ?? name,
	};
}

function contributionCalendar(ctx: GraphQLContext, user: GitHubUser) {
	const counts = new Map<string, number>();
	const bump = (iso: string | null | undefined) => {
		if (!iso) return;
		const day = iso.slice(0, 10);
		counts.set(day, (counts.get(day) ?? 0) + 1);
	};
	for (const commit of ctx.gh.commits.all()) {
		if (commit.user_id === user.id && commit.parent_shas.length < 2)
			bump(commit.committer_date);
	}
	for (const issue of ctx.gh.issues.all())
		if (issue.user_id === user.id) bump(issue.created_at);
	for (const review of ctx.gh.reviews.all()) {
		if (review.user_id === user.id && review.submitted_at)
			bump(review.submitted_at);
	}

	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);
	const start = new Date(today);
	start.setUTCDate(start.getUTCDate() - 52 * 7 - today.getUTCDay());
	const days: Array<{ date: string; weekday: number; count: number }> = [];
	for (
		const cursor = new Date(start);
		cursor <= today;
		cursor.setUTCDate(cursor.getUTCDate() + 1)
	) {
		const date = cursor.toISOString().slice(0, 10);
		const weekday = cursor.getUTCDay();
		// Deterministic background activity so the graph looks lived-in.
		const noise = hashString(`${user.login}:${date}`);
		const weekend = weekday === 0 || weekday === 6;
		const background = noise % 100 < (weekend ? 12 : 55) ? 1 + (noise % 5) : 0;
		days.push({ date, weekday, count: (counts.get(date) ?? 0) + background });
	}
	const max = Math.max(1, ...days.map((day) => day.count));
	const level = (count: number) =>
		count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));
	const weeks: Array<{ firstDay: string; contributionDays: unknown[] }> = [];
	for (let index = 0; index < days.length; index += 7) {
		const chunk = days.slice(index, index + 7);
		weeks.push({
			firstDay: chunk[0].date,
			contributionDays: chunk.map((day) => ({
				date: day.date,
				weekday: day.weekday,
				contributionCount: day.count,
				contributionLevel: CONTRIBUTION_LEVELS[level(day.count)],
				color: CONTRIBUTION_COLORS[level(day.count)],
			})),
		});
	}
	return {
		totalContributions: days.reduce((sum, day) => sum + day.count, 0),
		colors: CONTRIBUTION_COLORS.slice(1),
		isHalloween: false,
		weeks,
	};
}

function reviewNodeId(review: GitHubReview) {
	return review.node_id || encodeNodeId("PullRequestReview", review.id);
}

function viewerOrThrow(ctx: GraphQLContext) {
	if (!ctx.viewer) {
		throw new GraphQLError("This endpoint requires you to be authenticated.", {
			extensions: { type: "FORBIDDEN" },
		});
	}
	return ctx.viewer;
}

type NodeModel =
	| PullModel
	| IssueModel
	| IssueCommentModel
	| ReviewCommentModel
	| ThreadModel
	| RepoModel
	| UserModel;

function nodeById(ctx: GraphQLContext, id: string): NodeModel | null {
	const decoded = decodeNodeId(id);
	if (!decoded) return null;
	const { gh } = ctx;
	switch (decoded.type) {
		case "PullRequest": {
			const pull = gh.pullRequests.get(decoded.id);
			const repo = pull ? gh.repos.get(pull.repo_id) : undefined;
			return pull && repo ? issueOrPullModel(ctx, repo, pull.number) : null;
		}
		case "Issue": {
			const issue = gh.issues.get(decoded.id);
			const repo = issue ? gh.repos.get(issue.repo_id) : undefined;
			return issue && repo ? issueOrPullModel(ctx, repo, issue.number) : null;
		}
		case "IssueComment":
		case "PullRequestReviewComment": {
			const comment = gh.comments.get(decoded.id);
			const repo = comment ? gh.repos.get(comment.repo_id) : undefined;
			if (!comment || !repo) return null;
			return comment.comment_type === "review"
				? ({
						__typename: "PullRequestReviewComment",
						comment,
						repo,
					} satisfies ReviewCommentModel)
				: ({
						__typename: "IssueComment",
						comment,
						repo,
					} satisfies IssueCommentModel);
		}
		case "PullRequestReviewThread": {
			const root = gh.comments.get(decoded.id);
			const repo = root ? gh.repos.get(root.repo_id) : undefined;
			if (!root || !repo || root.pull_number === null) return null;
			return (
				threadsFor(ctx, repo, root.pull_number).find(
					(thread) => thread.root.id === root.id,
				) ?? null
			);
		}
		case "Repository": {
			const repo = gh.repos.get(decoded.id);
			return repo
				? ({ __typename: "Repository", repo } satisfies RepoModel)
				: null;
		}
		case "User":
			return userModel(gh.users.get(decoded.id));
		default:
			return null;
	}
}

function toggleReaction(ctx: GraphQLContext, args: Args, add: boolean) {
	const viewer = viewerOrThrow(ctx);
	const input = args.input as { subjectId: string; content: string };
	const model = nodeById(ctx, input.subjectId) as
		| (PullModel | IssueModel | IssueCommentModel | ReviewCommentModel)
		| null;
	const subject = model ? reactionSubject(model) : null;
	if (!model || !subject) {
		throw notFoundError(
			`Could not resolve to a node with the global id of '${input.subjectId}'`,
		);
	}
	const existing = ctx.extras.reactions
		.findBy("subject_id", subject.subject_id)
		.find(
			(row) =>
				row.subject_type === subject.subject_type &&
				row.user_id === viewer.id &&
				row.content === input.content,
		);
	let reaction: ReactionRow | undefined = existing;
	if (add && !existing) {
		reaction = ctx.extras.reactions.insert({
			...subject,
			user_id: viewer.id,
			content: input.content,
		});
	}
	if (!add && existing) {
		ctx.extras.reactions.delete(existing.id);
	}
	return { reaction: reaction ?? null, subject: model };
}

const actorFields = {
	avatarUrl: (model: UserModel, _args: Args, ctx: GraphQLContext) =>
		avatarUrl(ctx, model.user.login),
	url: (model: UserModel) => webUrl(model.user.login),
	login: (model: UserModel) => model.user.login,
};

const reactableFields = {
	reactions: (
		model: { __typename: string; issue?: GitHubIssue; comment?: GitHubComment },
		args: Args,
		ctx: GraphQLContext,
	) => reactionsConnection(ctx, model, args),
};

function minimized(ctx: GraphQLContext, comment: GitHubComment) {
	return ctx.extras.minimized.findOneBy("comment_id", comment.id) ?? null;
}

function issueLikeFields() {
	return {
		id: (model: IssueModel | PullModel) =>
			model.__typename === "PullRequest"
				? model.pull.node_id
				: model.issue.node_id,
		databaseId: (model: IssueModel | PullModel) =>
			model.__typename === "PullRequest" ? model.pull.id : model.issue.id,
		number: (model: IssueModel | PullModel) =>
			model.__typename === "PullRequest"
				? model.pull.number
				: model.issue.number,
		title: (model: IssueModel | PullModel) =>
			model.__typename === "PullRequest" ? model.pull.title : model.issue.title,
		body: (model: IssueModel | PullModel) =>
			(model.__typename === "PullRequest"
				? model.pull.body
				: model.issue.body) ?? "",
		createdAt: (model: IssueModel | PullModel) =>
			model.__typename === "PullRequest"
				? model.pull.created_at
				: model.issue.created_at,
		updatedAt: (model: IssueModel | PullModel) =>
			model.__typename === "PullRequest"
				? model.pull.updated_at
				: model.issue.updated_at,
		closedAt: (model: IssueModel | PullModel) =>
			model.__typename === "PullRequest"
				? model.pull.closed_at
				: model.issue.closed_at,
		author: (model: IssueModel | PullModel, _args: Args, ctx: GraphQLContext) =>
			actorById(
				ctx,
				model.__typename === "PullRequest"
					? model.pull.user_id
					: model.issue.user_id,
			),
		repository: (model: IssueModel | PullModel) => ({
			__typename: "Repository",
			repo: model.repo,
		}),
		milestone: (
			model: IssueModel | PullModel,
			_args: Args,
			ctx: GraphQLContext,
		) => {
			const id =
				(model.__typename === "PullRequest" ? model.pull.milestone_id : null) ??
				model.issue.milestone_id;
			return id ? (ctx.gh.milestones.get(id) ?? null) : null;
		},
		labels: (
			model: IssueModel | PullModel,
			args: Args,
			ctx: GraphQLContext,
		) => {
			const ids = new Set([
				...(model.issue.label_ids ?? []),
				...(model.__typename === "PullRequest" ? model.pull.label_ids : []),
			]);
			const labels = [...ids]
				.map((id) => ctx.gh.labels.get(id))
				.filter((label) => label !== undefined);
			return connection(labels, args);
		},
		assignees: (
			model: IssueModel | PullModel,
			args: Args,
			ctx: GraphQLContext,
		) => {
			const ids = new Set([
				...(model.issue.assignee_ids ?? []),
				...(model.__typename === "PullRequest" ? model.pull.assignee_ids : []),
			]);
			return connection(
				[...ids].map((id) => userModel(ctx.gh.users.get(id))).filter(Boolean),
				args,
			);
		},
		comments: (
			model: IssueModel | PullModel,
			args: Args,
			ctx: GraphQLContext,
		) => {
			const number =
				model.__typename === "PullRequest"
					? model.pull.number
					: model.issue.number;
			return connection(
				issueComments(ctx, model.repo, number).map((comment) => ({
					__typename: "IssueComment",
					comment,
					repo: model.repo,
				})),
				args,
			);
		},
		...reactableFields,
		timelineItems: (
			model: IssueModel | PullModel,
			args: Args,
			ctx: GraphQLContext,
		) => {
			const types = (args.itemTypes as string[] | undefined) ?? [
				"CROSS_REFERENCED_EVENT",
			];
			const items = types.includes("CROSS_REFERENCED_EVENT")
				? crossReferences(ctx, model)
				: [];
			return connection(items, args);
		},
	};
}

export const resolvers: Record<string, Record<string, unknown>> = {
	Query: {
		repository: (_source: unknown, args: Args, ctx: GraphQLContext) => {
			const repo = visibleRepo(ctx, String(args.owner), String(args.name));
			if (!repo) {
				throw notFoundError(
					`Could not resolve to a Repository with the name '${args.owner}/${args.name}'.`,
				);
			}
			return { __typename: "Repository", repo } satisfies RepoModel;
		},
		user: (_source: unknown, args: Args, ctx: GraphQLContext) => {
			const user = ctx.gh.users.findOneBy("login", String(args.login));
			if (!user) {
				throw notFoundError(
					`Could not resolve to a User with the login of '${args.login}'.`,
				);
			}
			return userModel(user);
		},
		organization: (_source: unknown, args: Args, ctx: GraphQLContext) => {
			const org = ctx.gh.orgs.findOneBy("login", String(args.login));
			if (!org) {
				throw notFoundError(
					`Could not resolve to an Organization with the login of '${args.login}'.`,
				);
			}
			return { __typename: "Organization", org } satisfies OrgModel;
		},
		viewer: (_source: unknown, _args: Args, ctx: GraphQLContext) =>
			userModel(viewerOrThrow(ctx)),
		node: (_source: unknown, args: Args, ctx: GraphQLContext) =>
			nodeById(ctx, String(args.id)),
		search: (_source: unknown, args: Args, ctx: GraphQLContext) => {
			if (args.type !== "ISSUE" && args.type !== "ISSUE_ADVANCED") {
				return {
					...connection([], args),
					issueCount: 0,
					repositoryCount: 0,
					userCount: 0,
					discussionCount: 0,
				};
			}
			const hits = searchIssues(ctx.shim, String(args.query), ctx.auth);
			const models = hits
				.map((hit) => issueOrPullModel(ctx, hit.repo, hit.issue.number))
				.filter(Boolean);
			return {
				...connection(models, { first: 10, ...args }),
				issueCount: models.length,
				repositoryCount: 0,
				userCount: 0,
				discussionCount: 0,
			};
		},
		rateLimit: () => ({
			cost: 1,
			limit: 5000,
			nodeCount: 1,
			remaining: 4999,
			used: 1,
			resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
		}),
	},

	Mutation: {
		markPullRequestReadyForReview: (
			_source: unknown,
			args: Args,
			ctx: GraphQLContext,
		) => {
			viewerOrThrow(ctx);
			const input = args.input as { pullRequestId: string };
			const model = nodeById(ctx, input.pullRequestId) as PullModel | null;
			if (model?.__typename !== "PullRequest") {
				throw notFoundError(
					`Could not resolve to a node with the global id of '${input.pullRequestId}'`,
				);
			}
			const pull = ctx.gh.pullRequests.update(model.pull.id, {
				draft: false,
				mergeable_state: "clean",
			}) as GitHubPullRequest;
			ctx.shim.webhooks.dispatch(
				"pull_request",
				"ready_for_review",
				{
					action: "ready_for_review",
					number: pull.number,
					pull_request: { number: pull.number, draft: false },
					repository: {
						full_name: model.repo.full_name,
						name: model.repo.name,
					},
					sender: { login: ctx.viewer?.login },
				},
				ownerLogin(ctx.gh, model.repo),
				model.repo.name,
			);
			return { pullRequest: { ...model, pull } };
		},
		convertPullRequestToDraft: (
			_source: unknown,
			args: Args,
			ctx: GraphQLContext,
		) => {
			viewerOrThrow(ctx);
			const input = args.input as { pullRequestId: string };
			const model = nodeById(ctx, input.pullRequestId) as PullModel | null;
			if (model?.__typename !== "PullRequest") {
				throw notFoundError(
					`Could not resolve to a node with the global id of '${input.pullRequestId}'`,
				);
			}
			const pull = ctx.gh.pullRequests.update(model.pull.id, {
				draft: true,
				mergeable_state: "draft",
			}) as GitHubPullRequest;
			return { pullRequest: { ...model, pull } };
		},
		resolveReviewThread: (_source: unknown, args: Args, ctx: GraphQLContext) =>
			setThreadResolved(ctx, args, true),
		unresolveReviewThread: (
			_source: unknown,
			args: Args,
			ctx: GraphQLContext,
		) => setThreadResolved(ctx, args, false),
		addReaction: (_source: unknown, args: Args, ctx: GraphQLContext) =>
			toggleReaction(ctx, args, true),
		removeReaction: (_source: unknown, args: Args, ctx: GraphQLContext) =>
			toggleReaction(ctx, args, false),
		minimizeComment: (_source: unknown, args: Args, ctx: GraphQLContext) => {
			viewerOrThrow(ctx);
			const input = args.input as { subjectId: string; classifier: string };
			const model = nodeById(ctx, input.subjectId) as
				| IssueCommentModel
				| ReviewCommentModel
				| null;
			if (!model?.comment) {
				throw notFoundError(
					`Could not resolve to a node with the global id of '${input.subjectId}'`,
				);
			}
			const existing = ctx.extras.minimized.findOneBy(
				"comment_id",
				model.comment.id,
			);
			if (existing) {
				ctx.extras.minimized.update(existing.id, {
					classifier: input.classifier,
				});
			} else {
				ctx.extras.minimized.insert({
					comment_id: model.comment.id,
					classifier: input.classifier,
				});
			}
			return { minimizedComment: model };
		},
		unminimizeComment: (_source: unknown, args: Args, ctx: GraphQLContext) => {
			viewerOrThrow(ctx);
			const input = args.input as { subjectId: string };
			const model = nodeById(ctx, input.subjectId) as
				| IssueCommentModel
				| ReviewCommentModel
				| null;
			if (!model?.comment) {
				throw notFoundError(
					`Could not resolve to a node with the global id of '${input.subjectId}'`,
				);
			}
			const existing = ctx.extras.minimized.findOneBy(
				"comment_id",
				model.comment.id,
			);
			if (existing) ctx.extras.minimized.delete(existing.id);
			return { unminimizedComment: model };
		},
	},

	User: {
		...actorFields,
		id: (model: UserModel) => model.user.node_id,
		databaseId: (model: UserModel) => model.user.id,
		name: (model: UserModel) => model.user.name,
		email: (model: UserModel) => model.user.email ?? "",
		bio: (model: UserModel) => model.user.bio,
		company: (model: UserModel) => model.user.company,
		location: (model: UserModel) => model.user.location,
		createdAt: (model: UserModel) => model.user.created_at,
		contributionsCollection: (
			model: UserModel,
			_args: Args,
			ctx: GraphQLContext,
		) => {
			const calendar = contributionCalendar(ctx, model.user);
			const count = (
				predicate: (row: { user_id: number }) => boolean,
				rows: Array<{ user_id: number }>,
			) => rows.filter(predicate).length;
			return {
				contributionCalendar: calendar,
				totalCommitContributions: ctx.gh.commits
					.all()
					.filter((row) => row.user_id === model.user.id).length,
				totalIssueContributions: count(
					(row) => row.user_id === model.user.id,
					ctx.gh.issues.all().filter((row) => !row.is_pull_request),
				),
				totalPullRequestContributions: count(
					(row) => row.user_id === model.user.id,
					ctx.gh.pullRequests.all(),
				),
				totalPullRequestReviewContributions: count(
					(row) => row.user_id === model.user.id,
					ctx.gh.reviews.all(),
				),
			};
		},
		pinnedItems: (model: UserModel, args: Args, ctx: GraphQLContext) => {
			const pinned = ctx.extras.pinned.findOneBy("user_id", model.user.id);
			const repos = (pinned?.repo_ids ?? [])
				.map((id) => ctx.gh.repos.get(id))
				.filter(
					(repo): repo is GitHubRepo =>
						Boolean(repo) && canReadRepo(ctx.gh, ctx.auth, repo as GitHubRepo),
				)
				.map((repo) => ({ __typename: "Repository", repo }));
			return connection(repos, args);
		},
	},

	Organization: {
		id: (model: OrgModel) => model.org.node_id,
		databaseId: (model: OrgModel) => model.org.id,
		login: (model: OrgModel) => model.org.login,
		name: (model: OrgModel) => model.org.name,
		description: (model: OrgModel) => model.org.description,
		avatarUrl: (model: OrgModel, _args: Args, ctx: GraphQLContext) =>
			avatarUrl(ctx, model.org.login),
		url: (model: OrgModel) => webUrl(model.org.login),
	},

	Team: {
		id: (model: TeamModel) => model.team.node_id,
		name: (model: TeamModel) => model.team.name,
		slug: (model: TeamModel) => model.team.slug,
		combinedSlug: (model: TeamModel) =>
			`${model.org?.login ?? ""}/${model.team.slug}`,
		url: (model: TeamModel) =>
			webUrl(`orgs/${model.org?.login ?? ""}/teams/${model.team.slug}`),
	},

	Repository: {
		id: (model: RepoModel) => model.repo.node_id,
		databaseId: (model: RepoModel) => model.repo.id,
		name: (model: RepoModel) => model.repo.name,
		nameWithOwner: (model: RepoModel) => model.repo.full_name,
		description: (model: RepoModel) => model.repo.description,
		url: (model: RepoModel) => webUrl(model.repo.full_name),
		homepageUrl: (model: RepoModel) => model.repo.homepage,
		isPrivate: (model: RepoModel) => model.repo.private,
		isFork: (model: RepoModel) => model.repo.fork,
		isArchived: (model: RepoModel) => model.repo.archived,
		isTemplate: (model: RepoModel) => model.repo.is_template,
		createdAt: (model: RepoModel) => model.repo.created_at,
		updatedAt: (model: RepoModel) => model.repo.updated_at,
		pushedAt: (model: RepoModel) => model.repo.pushed_at,
		owner: (model: RepoModel, _args: Args, ctx: GraphQLContext) =>
			ownerModel(ctx, model.repo),
		parent: (model: RepoModel, _args: Args, ctx: GraphQLContext) => {
			const parent = model.repo.forked_from_id
				? ctx.gh.repos.get(model.repo.forked_from_id)
				: undefined;
			return parent ? { __typename: "Repository", repo: parent } : null;
		},
		viewerHasStarred: (model: RepoModel, _args: Args, ctx: GraphQLContext) =>
			Boolean(
				ctx.viewer &&
					ctx.extras.stars
						.findBy("user_id", ctx.viewer.id)
						.some((row) => row.repo_id === model.repo.id),
			),
		viewerPermission: (model: RepoModel, _args: Args, ctx: GraphQLContext) =>
			viewerPermission(ctx, model.repo),
		stargazerCount: (model: RepoModel) => model.repo.stargazers_count,
		forkCount: (model: RepoModel) => model.repo.forks_count,
		watchers: (model: RepoModel, args: Args) => ({
			...connection([], args),
			totalCount: model.repo.watchers_count,
		}),
		primaryLanguage: (model: RepoModel) =>
			model.repo.language
				? {
						id: encodeNodeId(
							"Language",
							hashString(model.repo.language) % 100_000,
						),
						name: model.repo.language,
						color: LANGUAGE_COLORS[model.repo.language] ?? "#8b949e",
					}
				: null,
		licenseInfo: (model: RepoModel) =>
			model.repo.license
				? {
						id: encodeNodeId(
							"License",
							hashString(model.repo.license.key) % 100_000,
						),
						key: model.repo.license.key,
						name: model.repo.license.name,
						spdxId: model.repo.license.spdx_id,
					}
				: null,
		repositoryTopics: (model: RepoModel, args: Args) =>
			connection(
				model.repo.topics.map((name) => ({
					id: encodeNodeId("RepositoryTopic", hashString(name) % 100_000),
					topic: {
						id: encodeNodeId("Topic", hashString(name) % 100_000),
						name,
					},
					url: webUrl(`topics/${name}`),
				})),
				args,
			),
		hasIssuesEnabled: (model: RepoModel) => model.repo.has_issues,
		hasDiscussionsEnabled: (model: RepoModel) => model.repo.has_discussions,
		defaultBranchRef: (model: RepoModel, _args: Args, ctx: GraphQLContext) =>
			refsFor(ctx, model.repo, "refs/heads/").find(
				(ref) => ref.name === model.repo.default_branch,
			) ?? null,
		ref: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			const qualified = String(args.qualifiedName);
			const prefix = qualified.startsWith("refs/tags/")
				? "refs/tags/"
				: "refs/heads/";
			const name = qualified.replace(/^refs\/(heads|tags)\//u, "");
			return (
				refsFor(ctx, model.repo, prefix).find((ref) => ref.name === name) ??
				null
			);
		},
		refs: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			const query =
				typeof args.query === "string" ? args.query.toLowerCase() : "";
			let refs = refsFor(ctx, model.repo, String(args.refPrefix)).filter(
				(ref) => !query || ref.name.toLowerCase().includes(query),
			);
			const orderBy = args.orderBy as
				| { field: string; direction: string }
				| undefined;
			if (orderBy?.field === "TAG_COMMIT_DATE") {
				const sign = orderBy.direction === "DESC" ? -1 : 1;
				refs = refs.sort(
					(a, b) =>
						sign * refTargetDate(ctx, a).localeCompare(refTargetDate(ctx, b)),
				);
			} else {
				const sign = (orderBy?.direction ?? args.direction) === "DESC" ? -1 : 1;
				refs = refs.sort((a, b) => sign * a.name.localeCompare(b.name));
			}
			return connection(refs, args);
		},
		object: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			if (typeof args.oid === "string") {
				return gitObject(ctx, model.repo, args.oid);
			}
			const expression = String(args.expression ?? "HEAD");
			const separator = expression.indexOf(":");
			const revision =
				separator === -1
					? expression
					: expression.slice(0, separator) || "HEAD";
			const commit = resolveRevision(ctx.gh, model.repo, revision);
			if (!commit) return null;
			if (separator === -1) {
				return {
					__typename: "Commit",
					commit,
					repo: model.repo,
				} satisfies CommitModel;
			}
			const entry = lookupPath(
				ctx.gh,
				model.repo.id,
				commit.tree_sha,
				expression.slice(separator + 1),
			);
			if (!entry) return null;
			return entry.type === "tree"
				? ({
						__typename: "Tree",
						sha: entry.sha,
						repo: model.repo,
					} satisfies TreeModel)
				: ({
						__typename: "Blob",
						sha: entry.sha,
						repo: model.repo,
					} satisfies BlobModel);
		},
		issue: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			const found = issueOrPullModel(ctx, model.repo, Number(args.number));
			if (found?.__typename !== "Issue") {
				throw notFoundError(
					`Could not resolve to an Issue with the number of ${args.number}.`,
				);
			}
			return found;
		},
		pullRequest: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			const found = issueOrPullModel(ctx, model.repo, Number(args.number));
			if (found?.__typename !== "PullRequest") {
				throw notFoundError(
					`Could not resolve to a PullRequest with the number of ${args.number}.`,
				);
			}
			return found;
		},
		issueOrPullRequest: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			const found = issueOrPullModel(ctx, model.repo, Number(args.number));
			if (!found) {
				throw notFoundError(
					`Could not resolve to an issue or pull request with the number of ${args.number}.`,
				);
			}
			return found;
		},
		issues: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			const rows = sortByOrder(
				ctx.gh.issues
					.findBy("repo_id", model.repo.id)
					.filter((row) => !row.is_pull_request),
				args.orderBy,
			);
			const models = filterByStates(
				rows.map((issue) => ({
					__typename: "Issue" as const,
					issue,
					repo: model.repo,
				})),
				args.states,
			);
			return connection(models, args);
		},
		pullRequests: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			let models = filterByStates(pullModelsFor(ctx, model.repo), args.states);
			if (typeof args.headRefName === "string")
				models = models.filter((m) => m.pull.head_ref === args.headRefName);
			if (typeof args.baseRefName === "string")
				models = models.filter((m) => m.pull.base_ref === args.baseRefName);
			const sorted = sortByOrder(
				models.map((m) => m.pull),
				args.orderBy,
			).map((pull) => models.find((m) => m.pull.id === pull.id) as PullModel);
			return connection(sorted, args);
		},
		discussions: (model: RepoModel, args: Args, ctx: GraphQLContext) => {
			let rows = ctx.extras.discussions.findBy("repo_id", model.repo.id);
			if (typeof args.answered === "boolean") {
				rows = rows.filter(
					(row) => Boolean(row.answer_chosen_at) === args.answered,
				);
			}
			const sorted = sortByOrder(
				rows,
				args.orderBy ?? { field: "UPDATED_AT", direction: "DESC" },
			);
			return connection(
				sorted.map((discussion) => ({
					__typename: "Discussion",
					discussion,
					repo: model.repo,
				})),
				args,
			);
		},
	},

	Ref: {
		id: (model: RefModel) =>
			encodeNodeId(
				"Ref",
				hashString(`${model.repo.id}:${model.prefix}${model.name}`) % 1_000_000,
			),
		name: (model: RefModel) => model.name,
		prefix: (model: RefModel) => model.prefix,
		target: (model: RefModel, _args: Args, ctx: GraphQLContext) =>
			gitObject(ctx, model.repo, model.sha),
		associatedPullRequests: (
			model: RefModel,
			args: Args,
			ctx: GraphQLContext,
		) => {
			if (model.prefix !== "refs/heads/") return connection([], args);
			const models = filterByStates(
				pullModelsFor(ctx, model.repo).filter(
					(pull) => pull.pull.head_ref === model.name,
				),
				args.states,
			);
			const sorted = sortByOrder(
				models.map((m) => m.pull),
				args.orderBy ?? { field: "UPDATED_AT", direction: "DESC" },
			).map((pull) => models.find((m) => m.pull.id === pull.id) as PullModel);
			return connection(sorted, args);
		},
	},

	Commit: {
		id: (model: CommitModel) => model.commit.node_id,
		oid: (model: CommitModel) => model.commit.sha,
		abbreviatedOid: (model: CommitModel) => model.commit.sha.slice(0, 7),
		commitUrl: (model: CommitModel) =>
			webUrl(`${model.repo.full_name}/commit/${model.commit.sha}`),
		url: (model: CommitModel) =>
			webUrl(`${model.repo.full_name}/commit/${model.commit.sha}`),
		message: (model: CommitModel) => model.commit.message,
		messageHeadline: (model: CommitModel) =>
			model.commit.message.split("\n")[0],
		messageBody: (model: CommitModel) =>
			model.commit.message.split("\n").slice(1).join("\n").trim(),
		committedDate: (model: CommitModel) => model.commit.committer_date,
		authoredDate: (model: CommitModel) => model.commit.author_date,
		author: (model: CommitModel, _args: Args, ctx: GraphQLContext) =>
			gitActor(
				ctx,
				model.commit.author_name,
				model.commit.author_email,
				model.commit.author_date,
				model.commit.user_id,
			),
		committer: (model: CommitModel, _args: Args, ctx: GraphQLContext) =>
			gitActor(
				ctx,
				model.commit.committer_name,
				model.commit.committer_email,
				model.commit.committer_date,
				null,
			),
		tree: (model: CommitModel) => ({
			__typename: "Tree",
			sha: model.commit.tree_sha,
			repo: model.repo,
		}),
		history: (model: CommitModel, args: Args, ctx: GraphQLContext) =>
			connection(
				historyForPath(
					ctx.gh,
					model.repo.id,
					model.commit.sha,
					args.path as string | undefined,
				).map((commit) => ({
					__typename: "Commit",
					commit,
					repo: model.repo,
				})),
				args,
			),
	},

	GitActor: {
		avatarUrl: (actor: { login: string }, _args: Args, ctx: GraphQLContext) =>
			avatarUrl(ctx, actor.login),
	},

	Tree: {
		id: (model: TreeModel) =>
			encodeNodeId("Tree", hashString(model.sha) % 1_000_000),
		oid: (model: TreeModel) => model.sha,
		abbreviatedOid: (model: TreeModel) => model.sha.slice(0, 7),
		commitUrl: (model: TreeModel) => webUrl(model.repo.full_name),
	},

	Blob: {
		id: (model: BlobModel) =>
			encodeNodeId("Blob", hashString(model.sha) % 1_000_000),
		oid: (model: BlobModel) => model.sha,
		abbreviatedOid: (model: BlobModel) => model.sha.slice(0, 7),
		commitUrl: (model: BlobModel) => webUrl(model.repo.full_name),
		byteSize: (model: BlobModel, _args: Args, ctx: GraphQLContext) =>
			ctx.gh.blobs
				.findBy("repo_id", model.repo.id)
				.find((row) => row.sha === model.sha)?.size ?? 0,
		isBinary: () => false,
		isTruncated: () => false,
		text: (model: BlobModel, _args: Args, ctx: GraphQLContext) => {
			const blob = ctx.gh.blobs
				.findBy("repo_id", model.repo.id)
				.find((row) => row.sha === model.sha);
			if (!blob) return null;
			return blob.encoding === "base64"
				? Buffer.from(blob.content, "base64").toString("utf8")
				: blob.content;
		},
	},

	Tag: {
		id: (model: TagModel) => model.tag.node_id,
		oid: (model: TagModel) => model.tag.sha,
		abbreviatedOid: (model: TagModel) => model.tag.sha.slice(0, 7),
		commitUrl: (model: TagModel) =>
			webUrl(`${model.repo.full_name}/commit/${model.tag.object_sha}`),
		name: (model: TagModel) => model.tag.tag,
		message: (model: TagModel) => model.tag.message,
		tagger: (model: TagModel, _args: Args, ctx: GraphQLContext) =>
			gitActor(
				ctx,
				model.tag.tagger_name,
				model.tag.tagger_email,
				model.tag.tagger_date,
				null,
			),
		target: (model: TagModel, _args: Args, ctx: GraphQLContext) =>
			gitObject(ctx, model.repo, model.tag.object_sha),
	},

	Reaction: {
		id: (row: ReactionRow) => encodeNodeId("Reaction", row.id),
		databaseId: (row: ReactionRow) => row.id,
		content: (row: ReactionRow) => row.content,
		createdAt: (row: ReactionRow) => row.created_at,
		user: (row: ReactionRow, _args: Args, ctx: GraphQLContext) =>
			actorById(ctx, row.user_id),
	},

	Label: {
		id: (label: { node_id: string }) => label.node_id,
	},

	Milestone: {
		id: (milestone: { node_id: string }) => milestone.node_id,
		dueOn: (milestone: { due_on: string | null }) => milestone.due_on,
		state: (milestone: { state: string }) => milestone.state.toUpperCase(),
		url: (
			milestone: { number: number; repo_id: number },
			_args: Args,
			ctx: GraphQLContext,
		) =>
			webUrl(
				`${ctx.gh.repos.get(milestone.repo_id)?.full_name ?? ""}/milestone/${milestone.number}`,
			),
	},

	IssueComment: {
		id: (model: IssueCommentModel) => model.comment.node_id,
		databaseId: (model: IssueCommentModel) => model.comment.id,
		body: (model: IssueCommentModel) => model.comment.body,
		bodyText: (model: IssueCommentModel) => model.comment.body,
		createdAt: (model: IssueCommentModel) => model.comment.created_at,
		updatedAt: (model: IssueCommentModel) => model.comment.updated_at,
		lastEditedAt: (model: IssueCommentModel) =>
			model.comment.updated_at > model.comment.created_at
				? model.comment.updated_at
				: null,
		author: (model: IssueCommentModel, _args: Args, ctx: GraphQLContext) =>
			actorById(ctx, model.comment.user_id),
		url: (model: IssueCommentModel) =>
			webUrl(
				`${model.repo.full_name}/issues/${model.comment.issue_number}#issuecomment-${model.comment.id}`,
			),
		isMinimized: (model: IssueCommentModel, _args: Args, ctx: GraphQLContext) =>
			Boolean(minimized(ctx, model.comment)),
		minimizedReason: (
			model: IssueCommentModel,
			_args: Args,
			ctx: GraphQLContext,
		) => minimized(ctx, model.comment)?.classifier.toLowerCase() ?? null,
		...reactableFields,
	},

	Issue: {
		...issueLikeFields(),
		state: (model: IssueModel) => model.issue.state.toUpperCase(),
		stateReason: (model: IssueModel) =>
			model.issue.state_reason?.toUpperCase() ?? null,
		url: (model: IssueModel) =>
			webUrl(`${model.repo.full_name}/issues/${model.issue.number}`),
	},

	PullRequest: {
		...issueLikeFields(),
		state: (model: PullModel) => pullState(model.pull),
		isDraft: (model: PullModel) => model.pull.draft,
		mergedAt: (model: PullModel) => model.pull.merged_at,
		url: (model: PullModel) =>
			webUrl(`${model.repo.full_name}/pull/${model.pull.number}`),
		additions: async (model: PullModel, _args: Args, ctx: GraphQLContext) =>
			(await pullFiles(ctx, model)).reduce(
				(sum, file) => sum + file.additions,
				0,
			),
		deletions: async (model: PullModel, _args: Args, ctx: GraphQLContext) =>
			(await pullFiles(ctx, model)).reduce(
				(sum, file) => sum + file.deletions,
				0,
			),
		changedFiles: async (model: PullModel, _args: Args, ctx: GraphQLContext) =>
			(await pullFiles(ctx, model)).length,
		headRefName: (model: PullModel) => model.pull.head_ref,
		headRefOid: (model: PullModel) => model.pull.head_sha,
		headRepository: (model: PullModel, _args: Args, ctx: GraphQLContext) => {
			const repo = ctx.gh.repos.get(model.pull.head_repo_id);
			return repo ? { __typename: "Repository", repo } : null;
		},
		headRepositoryOwner: (
			model: PullModel,
			_args: Args,
			ctx: GraphQLContext,
		) => {
			const repo = ctx.gh.repos.get(model.pull.head_repo_id) ?? model.repo;
			return ownerModel(ctx, repo);
		},
		baseRefName: (model: PullModel) => model.pull.base_ref,
		baseRefOid: (model: PullModel) => model.pull.base_sha,
		merged: (model: PullModel) => model.pull.merged,
		mergeCommit: (model: PullModel, _args: Args, ctx: GraphQLContext) => {
			const sha = model.pull.merge_commit_sha;
			const commit = sha ? findCommit(ctx.gh, model.repo.id, sha) : undefined;
			return commit ? { __typename: "Commit", commit, repo: model.repo } : null;
		},
		mergedBy: (model: PullModel, _args: Args, ctx: GraphQLContext) =>
			actorById(ctx, model.pull.merged_by_id),
		mergeable: (model: PullModel) =>
			model.pull.mergeable === false
				? "CONFLICTING"
				: model.pull.mergeable
					? "MERGEABLE"
					: "UNKNOWN",
		mergeStateStatus: (model: PullModel) => {
			if (model.pull.draft) return "DRAFT";
			const map: Record<string, string> = {
				clean: "CLEAN",
				dirty: "DIRTY",
				unstable: "UNSTABLE",
				blocked: "BLOCKED",
				behind: "BEHIND",
				draft: "DRAFT",
				has_hooks: "HAS_HOOKS",
			};
			return map[model.pull.mergeable_state] ?? "UNKNOWN";
		},
		reviewRequests: (model: PullModel, args: Args, ctx: GraphQLContext) => {
			const users = model.pull.requested_reviewer_ids.map((id) => ({
				id: encodeNodeId("ReviewRequest", model.pull.id * 1000 + id),
				requestedReviewer: actorById(ctx, id),
			}));
			const teams = model.pull.requested_team_ids.map((id) => {
				const team = ctx.gh.teams.get(id);
				return {
					id: encodeNodeId("ReviewRequest", model.pull.id * 1000 + 500 + id),
					requestedReviewer: team
						? ({
								__typename: "Team",
								team,
								org: ctx.gh.orgs.get(team.org_id),
							} satisfies TeamModel)
						: null,
				};
			});
			return connection([...users, ...teams], args);
		},
		reviewThreads: (model: PullModel, args: Args, ctx: GraphQLContext) =>
			connection(threadsFor(ctx, model.repo, model.pull.number), args),
		reviews: (model: PullModel, args: Args, ctx: GraphQLContext) => {
			const states = args.states as string[] | undefined;
			const author =
				typeof args.author === "string" ? args.author.toLowerCase() : null;
			const reviews = ctx.gh.reviews
				.findBy("repo_id", model.repo.id)
				.filter((review) => review.pull_number === model.pull.number)
				.filter(
					(review) =>
						review.state !== "PENDING" || review.user_id === ctx.viewer?.id,
				)
				.filter((review) => !states || states.includes(review.state))
				.filter(
					(review) =>
						!author ||
						ctx.gh.users.get(review.user_id)?.login.toLowerCase() === author,
				)
				.sort(byCreated)
				.map((review) => ({
					__typename: "PullRequestReview",
					review,
					repo: model.repo,
				}));
			return connection(reviews, args);
		},
		commits: (model: PullModel, args: Args, ctx: GraphQLContext) => {
			const commits = commitsBetween(
				ctx.gh,
				model.repo.id,
				model.pull.base_sha,
				model.pull.head_sha,
			);
			return connection(
				commits.map((commit) => ({
					id: encodeNodeId("PullRequestCommit", commit.id),
					commit: { __typename: "Commit", commit, repo: model.repo },
				})),
				args,
			);
		},
		files: async (model: PullModel, args: Args, ctx: GraphQLContext) => {
			const files = await pullFiles(ctx, model);
			return connection(
				files.map((file) => ({
					path: file.filename,
					additions: file.additions,
					deletions: file.deletions,
					changeType: CHANGE_TYPES[file.status] ?? "MODIFIED",
				})),
				args,
			);
		},
	},

	PullRequestReviewThread: {
		id: (model: ThreadModel) =>
			encodeNodeId("PullRequestReviewThread", model.root.id),
		isResolved: (model: ThreadModel, _args: Args, ctx: GraphQLContext) =>
			ctx.extras.threadStates.findOneBy("root_comment_id", model.root.id)
				?.resolved ?? false,
		resolvedBy: (model: ThreadModel, _args: Args, ctx: GraphQLContext) =>
			actorById(
				ctx,
				ctx.extras.threadStates.findOneBy("root_comment_id", model.root.id)
					?.resolved_by_id,
			),
		isOutdated: (model: ThreadModel, _args: Args, ctx: GraphQLContext) =>
			ctx.extras.commentRanges.findOneBy("comment_id", model.root.id)
				?.outdated ?? false,
		path: (model: ThreadModel) => model.root.path ?? "",
		line: (model: ThreadModel) => model.root.line,
		startLine: (model: ThreadModel, _args: Args, ctx: GraphQLContext) =>
			ctx.extras.commentRanges.findOneBy("comment_id", model.root.id)
				?.start_line ?? null,
		diffSide: (model: ThreadModel) => model.root.side ?? "RIGHT",
		subjectType: (model: ThreadModel) =>
			model.root.subject_type === "file" ? "FILE" : "LINE",
		comments: (model: ThreadModel, args: Args) =>
			connection(
				model.comments.map((comment) => ({
					__typename: "PullRequestReviewComment",
					comment,
					repo: model.repo,
				})),
				args,
			),
	},

	PullRequestReviewComment: {
		id: (model: ReviewCommentModel) => model.comment.node_id,
		databaseId: (model: ReviewCommentModel) => model.comment.id,
		body: (model: ReviewCommentModel) => model.comment.body,
		path: (model: ReviewCommentModel) => model.comment.path ?? "",
		line: (model: ReviewCommentModel) => model.comment.line,
		startLine: (model: ReviewCommentModel, _args: Args, ctx: GraphQLContext) =>
			ctx.extras.commentRanges.findOneBy("comment_id", model.comment.id)
				?.start_line ?? null,
		originalLine: (model: ReviewCommentModel) => model.comment.line,
		diffHunk: () => "",
		subjectType: (model: ReviewCommentModel) =>
			model.comment.subject_type === "file" ? "FILE" : "LINE",
		outdated: (model: ReviewCommentModel, _args: Args, ctx: GraphQLContext) =>
			ctx.extras.commentRanges.findOneBy("comment_id", model.comment.id)
				?.outdated ?? false,
		createdAt: (model: ReviewCommentModel) => model.comment.created_at,
		updatedAt: (model: ReviewCommentModel) => model.comment.updated_at,
		author: (model: ReviewCommentModel, _args: Args, ctx: GraphQLContext) =>
			actorById(ctx, model.comment.user_id),
		url: (model: ReviewCommentModel) =>
			webUrl(
				`${model.repo.full_name}/pull/${model.comment.pull_number}#discussion_r${model.comment.id}`,
			),
		isMinimized: (
			model: ReviewCommentModel,
			_args: Args,
			ctx: GraphQLContext,
		) => Boolean(minimized(ctx, model.comment)),
		minimizedReason: (
			model: ReviewCommentModel,
			_args: Args,
			ctx: GraphQLContext,
		) => minimized(ctx, model.comment)?.classifier.toLowerCase() ?? null,
		...reactableFields,
	},

	PullRequestReview: {
		id: (model: ReviewModel) => reviewNodeId(model.review),
		databaseId: (model: ReviewModel) => model.review.id,
		body: (model: ReviewModel) => model.review.body ?? "",
		url: (model: ReviewModel) =>
			webUrl(
				`${model.repo.full_name}/pull/${model.review.pull_number}#pullrequestreview-${model.review.id}`,
			),
		state: (model: ReviewModel) => model.review.state,
		createdAt: (model: ReviewModel) => model.review.created_at,
		updatedAt: (model: ReviewModel) => model.review.updated_at,
		submittedAt: (model: ReviewModel) => model.review.submitted_at,
		author: (model: ReviewModel, _args: Args, ctx: GraphQLContext) =>
			actorById(ctx, model.review.user_id),
		comments: (model: ReviewModel, args: Args, ctx: GraphQLContext) =>
			connection(
				ctx.gh.comments
					.findBy("repo_id", model.repo.id)
					.filter((comment) => comment.review_id === model.review.id)
					.sort(byCreated)
					.map((comment) => ({
						__typename: "PullRequestReviewComment",
						comment,
						repo: model.repo,
					})),
				args,
			),
	},

	CrossReferencedEvent: {
		actor: (model: CrossReferenceModel, _args: Args, ctx: GraphQLContext) =>
			actorById(ctx, model.actorId),
		isCrossRepository: (model: CrossReferenceModel) =>
			model.source.repo.id !== model.target.repo.id,
		willCloseTarget: (model: CrossReferenceModel) => {
			const body =
				model.source.__typename === "PullRequest"
					? (model.source.pull.body ?? "")
					: "";
			return /\b(fix(es|ed)?|close[sd]?|resolve[sd]?)\s+#\d+/iu.test(body);
		},
	},

	Discussion: {
		id: (model: DiscussionModel) =>
			encodeNodeId("Discussion", model.discussion.id),
		number: (model: DiscussionModel) => model.discussion.number,
		title: (model: DiscussionModel) => model.discussion.title,
		createdAt: (model: DiscussionModel) => model.discussion.created_at,
		updatedAt: (model: DiscussionModel) => model.discussion.updated_at,
		author: (model: DiscussionModel, _args: Args, ctx: GraphQLContext) =>
			actorById(ctx, model.discussion.user_id),
		category: (model: DiscussionModel) => ({
			id: encodeNodeId(
				"DiscussionCategory",
				hashString(model.discussion.category_name) % 100_000,
			),
			name: model.discussion.category_name,
			emoji: model.discussion.category_emoji,
			emojiHTML: `<div><g-emoji class="g-emoji">${model.discussion.category_emoji}</g-emoji></div>`,
		}),
		comments: (model: DiscussionModel) => ({
			totalCount: model.discussion.comments_count,
		}),
		answerChosenAt: (model: DiscussionModel) =>
			model.discussion.answer_chosen_at,
		url: (model: DiscussionModel) =>
			webUrl(`${model.repo.full_name}/discussions/${model.discussion.number}`),
	},
};

function setThreadResolved(ctx: GraphQLContext, args: Args, resolved: boolean) {
	const viewer = viewerOrThrow(ctx);
	const input = args.input as { threadId: string };
	const thread = nodeById(ctx, input.threadId) as ThreadModel | null;
	if (thread?.__typename !== "PullRequestReviewThread") {
		throw notFoundError(
			`Could not resolve to a node with the global id of '${input.threadId}'`,
		);
	}
	const existing = ctx.extras.threadStates.findOneBy(
		"root_comment_id",
		thread.root.id,
	);
	if (existing) {
		ctx.extras.threadStates.update(existing.id, {
			resolved,
			resolved_by_id: resolved ? viewer.id : null,
		});
	} else {
		ctx.extras.threadStates.insert({
			root_comment_id: thread.root.id,
			resolved,
			resolved_by_id: resolved ? viewer.id : null,
		});
	}
	return { thread };
}

/** Abstract types resolve from the model's `__typename` tag. */
export const ABSTRACT_TYPES = [
	"Node",
	"Actor",
	"RepositoryOwner",
	"Reactable",
	"Minimizable",
	"GitObject",
	"PinnableItem",
	"ReferencedSubject",
	"IssueOrPullRequest",
	"IssueTimelineItems",
	"PullRequestTimelineItems",
	"RequestedReviewer",
	"SearchResultItem",
];

export function createGraphQLContext(
	shim: ShimContext,
	auth: AuthUser | undefined,
	authorization: string,
): GraphQLContext {
	const { gh, extras } = stores(shim);
	const viewer =
		auth && !auth.installation
			? (gh.users.findOneBy("login", auth.login) ?? null)
			: null;
	return {
		shim,
		gh,
		extras,
		auth,
		viewer,
		authorization,
		fileCache: new Map(),
	};
}
