import type {
	CommentReactionContent,
	CommentReactionSummary,
	GitHubActor,
	GitHubLabel,
	IssueComment,
	IssueSummary,
	PullSummary,
	RepositoryRef,
} from "../github.types";
import type {
	GitHubApiUser,
	GitHubGraphQLActor,
	GitHubGraphQLCommentConnection,
	GitHubGraphQLLabel,
	GitHubGraphQLRepositoryRef,
} from "./shared";

type GitHubApiLabel = {
	name?: string | null;
	color?: string | null;
	description?: string | null;
};

export function buildRepositoryRef(
	owner: string,
	repo: string,
	url?: string | null,
	isPrivate: boolean | null = null,
): RepositoryRef {
	return {
		name: repo,
		owner,
		fullName: `${owner}/${repo}`,
		url: url ?? `https://github.com/${owner}/${repo}`,
		isPrivate,
	};
}

export function mapGraphQLActor(actor: GitHubGraphQLActor): GitHubActor | null {
	if (!actor?.login) {
		return null;
	}

	return {
		login: actor.login,
		avatarUrl: actor.avatarUrl,
		url: actor.url,
		type: actor.__typename ?? "User",
	};
}

export function mapGraphQLRepositoryRef(
	repository: GitHubGraphQLRepositoryRef,
): RepositoryRef {
	const [ownerFromName, repoFromName] = repository.nameWithOwner.split("/");
	const owner = repository.owner.login || ownerFromName;

	return {
		name: repository.name || repoFromName,
		owner,
		fullName: repository.nameWithOwner,
		url: repository.url,
		isPrivate: repository.isPrivate,
		ownerAvatarUrl: repository.owner.avatarUrl,
	};
}

export function mapActor(
	user: GitHubApiUser | null | undefined,
): GitHubActor | null {
	if (!user?.login) {
		return null;
	}

	return {
		login: user.login,
		avatarUrl: user.avatar_url ?? "",
		url: user.html_url ?? `https://github.com/${user.login}`,
		type: user.type ?? "User",
	};
}

function mapLabel(
	label: string | GitHubApiLabel | null | undefined,
): GitHubLabel | null {
	if (!label || typeof label === "string" || !label.name) {
		return null;
	}

	return {
		name: label.name,
		color: label.color ?? "000000",
		description: label.description ?? null,
	};
}

export function mapLabels(
	labels: Array<string | GitHubApiLabel> | null | undefined,
) {
	return (labels ?? [])
		.map((label) => mapLabel(label))
		.filter((label): label is GitHubLabel => Boolean(label));
}

export function mapGraphQLLabels(
	labels: { nodes: Array<GitHubGraphQLLabel | null> | null } | null,
) {
	return (labels?.nodes ?? []).flatMap((label) =>
		label
			? [
					{
						name: label.name,
						color: label.color,
						description: label.description,
					},
				]
			: [],
	);
}

export function mapPullSummary(
	pull: {
		id: number;
		number: number;
		title: string;
		state: string;
		draft?: boolean | null;
		created_at: string;
		updated_at: string;
		closed_at: string | null;
		merged_at?: string | null;
		html_url: string;
		comments?: number;
		user?: GitHubApiUser | null;
		labels?: Array<string | GitHubApiLabel> | null;
		head?: { ref: string; repo?: { full_name: string } | null };
		base?: { ref: string };
	},
	repository: RepositoryRef,
): PullSummary {
	return {
		id: pull.id,
		number: pull.number,
		title: pull.title,
		state: pull.state,
		isDraft: "draft" in pull ? Boolean(pull.draft) : false,
		createdAt: pull.created_at,
		updatedAt: pull.updated_at,
		closedAt: pull.closed_at ?? null,
		mergedAt:
			"merged_at" in pull && typeof pull.merged_at === "string"
				? pull.merged_at
				: null,
		comments: pull.comments ?? 0,
		url: pull.html_url,
		author: mapActor(pull.user),
		labels: mapLabels(pull.labels),
		repository,
		...(pull.base?.ref ? { baseRefName: pull.base.ref } : {}),
		...(pull.head?.ref
			? {
					headRefName: pull.head.ref,
					headRepoFullName: pull.head.repo?.full_name ?? null,
				}
			: {}),
	};
}

export function mapIssueSummary(
	issue: {
		id: number;
		number: number;
		title: string;
		state: string;
		state_reason?: string | null;
		created_at: string;
		updated_at: string;
		closed_at: string | null;
		comments: number;
		html_url: string;
		user?: GitHubApiUser | null;
		labels?: Array<string | GitHubApiLabel> | null;
	},
	repository: RepositoryRef,
): IssueSummary {
	return {
		id: issue.id,
		number: issue.number,
		title: issue.title,
		state: issue.state,
		stateReason:
			"state_reason" in issue && typeof issue.state_reason === "string"
				? issue.state_reason
				: null,
		createdAt: issue.created_at,
		updatedAt: issue.updated_at,
		closedAt: issue.closed_at ?? null,
		comments: issue.comments,
		url: issue.html_url,
		author: mapActor(issue.user),
		labels: mapLabels(issue.labels),
		repository,
	};
}

function numericIdFromGraphQLId(id: string) {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

function gqlReactionContentToRest(
	content: string,
): CommentReactionContent | null {
	switch (content) {
		case "THUMBS_UP":
			return "+1";
		case "THUMBS_DOWN":
			return "-1";
		case "LAUGH":
			return "laugh";
		case "CONFUSED":
			return "confused";
		case "HEART":
			return "heart";
		case "HOORAY":
			return "hooray";
		case "ROCKET":
			return "rocket";
		case "EYES":
			return "eyes";
		default:
			return null;
	}
}

export function buildCommentReactionSummary(
	nodes:
		| Array<{ content: string; user: { login: string } | null } | null>
		| null
		| undefined,
	viewerLogin: string | undefined,
): CommentReactionSummary | undefined {
	const list = nodes?.filter((n): n is NonNullable<typeof n> => n != null);
	if (!list?.length) {
		return undefined;
	}

	const counts: Partial<Record<CommentReactionContent, number>> = {};
	const viewerReacted: CommentReactionContent[] = [];
	const userLoginsByContent: Partial<Record<CommentReactionContent, string[]>> =
		{};

	for (const node of list) {
		const rest = gqlReactionContentToRest(node.content);
		if (!rest) {
			continue;
		}
		counts[rest] = (counts[rest] ?? 0) + 1;
		const login = node.user?.login;
		if (login) {
			if (!userLoginsByContent[rest]) {
				userLoginsByContent[rest] = [];
			}
			userLoginsByContent[rest].push(login);
		}
		if (viewerLogin && node.user?.login === viewerLogin) {
			viewerReacted.push(rest);
		}
	}

	return { counts, viewerReacted, userLoginsByContent };
}

export function mapGraphQLComments(
	viewerLogin: string | undefined,
	...connections: GitHubGraphQLCommentConnection[]
): IssueComment[] {
	const byId = new Map<number, IssueComment>();

	for (const connection of connections) {
		for (const node of connection.nodes ?? []) {
			if (!node) {
				continue;
			}

			const id = node.databaseId ?? numericIdFromGraphQLId(node.id);
			byId.set(id, {
				id,
				graphqlId: node.id,
				body: node.body,
				createdAt: node.createdAt,
				editedAt: node.lastEditedAt ?? null,
				author: mapGraphQLActor(node.author),
				reactions: buildCommentReactionSummary(
					node.reactions?.nodes ?? undefined,
					viewerLogin,
				),
			});
		}
	}

	return [...byId.values()].sort(
		(a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
	);
}

/**
 * REST has no `lastEditedAt`; `updated_at` moves on body edits (reactions
 * don't touch it), so a later `updated_at` is the edit time.
 */
export function restEditedAt(comment: {
	created_at: string;
	updated_at?: string | null;
}): string | null {
	return comment.updated_at && comment.updated_at > comment.created_at
		? comment.updated_at
		: null;
}
