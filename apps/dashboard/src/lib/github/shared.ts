import { type Octokit as OctokitType, RequestError } from "octokit";
import { buildGitHubAppInstallUrl } from "../github-access";
import { getGitHubAppSlug } from "../github-app.server";

export type GitHubClient = OctokitType;
type AuthSession = {
	user: {
		id: string;
	};
};
export type GitHubContext = {
	session: AuthSession;
	octokit: GitHubClient;
};
export type GitHubGraphQLRateLimit = {
	cost: number;
	remaining: number;
	resetAt: string;
};
export type GitHubGraphQLActor = {
	login: string;
	avatarUrl: string;
	url: string;
	__typename?: string;
} | null;
export type GitHubGraphQLLabel = {
	name: string;
	color: string;
	description: string | null;
};
export type GitHubGraphQLRepositoryRef = {
	name: string;
	nameWithOwner: string;
	url: string;
	isPrivate: boolean;
	owner: {
		login: string;
		avatarUrl?: string;
	};
};
type GitHubGraphQLCommentNode = {
	id: string;
	databaseId: number | null;
	body: string;
	createdAt: string;
	lastEditedAt?: string | null;
	author: GitHubGraphQLActor;
	reactions?: {
		nodes: Array<{
			content: string;
			user: { login: string } | null;
		} | null> | null;
	} | null;
};
export type GitHubGraphQLCommentConnection = {
	totalCount: number;
	nodes: Array<GitHubGraphQLCommentNode | null> | null;
};
export type RepositoryPermissions = {
	admin?: boolean;
	maintain?: boolean;
	push?: boolean;
	triage?: boolean;
	pull?: boolean;
};

export type RepoState = "all" | "closed" | "open";
export const GITHUB_OPERATION_TIMEOUT_MS = 15_000;
export const GITHUB_PAGINATED_OPERATION_TIMEOUT_MS = 25_000;
export const GITHUB_MIN_OPERATION_TIMEOUT_MS = 1_000;

export type GitHubApiUser = {
	login?: string;
	avatar_url?: string;
	html_url?: string;
	type?: string;
};

export type GitHubInstallationAccountPayload = {
	id?: number;
	login?: string;
	avatar_url?: string | null;
	type?: string;
};

export type GitHubInstallationRepositoriesPayload = {
	repositories?: Array<{
		name?: string;
		full_name?: string;
		owner?: {
			login?: string;
		} | null;
	}>;
};

export function normalizeLogin(login: string) {
	return login.toLowerCase();
}

export type PullSearchRole =
	| "all"
	| "assigned"
	| "author"
	| "involved"
	| "mentioned"
	| "review-requested";

export type IssueSearchRole = "all" | "assigned" | "author" | "mentioned";

export type MutationFailure = {
	ok: false;
	error: string;
	installUrl?: string;
};

export type MutationResult = { ok: true } | MutationFailure;

/** GitHub sometimes returns 403 for resource-shape errors rather than auth — don't show the "install app" nudge for these. */
export function is403ResourceError(message: string): boolean {
	return (
		/invalid check_run_id/i.test(message) ||
		/cannot be rerequested/i.test(message) ||
		/not eligible/i.test(message)
	);
}

export function toMutationError(
	action: string,
	error: unknown,
): MutationFailure {
	console.error(`[${action}]`, error);
	if (error instanceof RequestError) {
		const msg =
			(error.response?.data as { message?: string } | undefined)?.message ??
			error.message;
		if (error.status === 403) {
			if (is403ResourceError(msg)) {
				return { ok: false, error: `Failed to ${action}: ${msg}` };
			}
			return {
				ok: false,
				error: `Failed to ${action}: Insufficient permissions`,
				installUrl: buildGitHubAppInstallUrl(getGitHubAppSlug()) ?? undefined,
			};
		}
		if (error.status === 404) {
			return { ok: false, error: `Failed to ${action}: Resource not found` };
		}
		if (error.status === 422) {
			return { ok: false, error: `Failed to ${action}: Validation failed` };
		}
		if (error.status === 409) {
			return {
				ok: false,
				error: `Failed to ${action}: Conflict — head branch may have been modified`,
			};
		}
		return { ok: false, error: `Failed to ${action}: ${msg}` };
	}
	return { ok: false, error: `Failed to ${action}: Unknown error` };
}

export type PullFromRepoInput = {
	owner: string;
	repo: string;
	pullNumber: number;
};

export function clampPerPage(value: number | undefined, fallback = 30) {
	if (!Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(Math.max(Math.trunc(value ?? fallback), 1), 100);
}

export function clampPage(value: number | undefined) {
	if (!Number.isFinite(value)) {
		return 1;
	}

	return Math.max(Math.trunc(value ?? 1), 1);
}
