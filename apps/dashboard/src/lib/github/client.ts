import { debug } from "../debug";
import { dedupeGitHubRead } from "./request-dedup";
import {
	GITHUB_MIN_OPERATION_TIMEOUT_MS,
	GITHUB_OPERATION_TIMEOUT_MS,
	GITHUB_PAGINATED_OPERATION_TIMEOUT_MS,
	type GitHubClient,
	type GitHubContext,
} from "./shared";

type GitHubRestResponse<TData> = {
	data: TData;
	headers: Record<string, unknown>;
	status: number;
};
type AuthenticatedUser = Awaited<
	ReturnType<GitHubClient["rest"]["users"]["getAuthenticated"]>
>["data"];

export class GitHubOperationTimeoutError extends Error {
	constructor(
		label: string,
		readonly timeoutMs: number,
	) {
		super(`${label} timed out after ${timeoutMs}ms`);
		this.name = "GitHubOperationTimeoutError";
	}
}

export function getRemainingSearchTimeoutMs(
	deadlineAt: number,
	maxTimeoutMs: number,
) {
	return Math.max(0, Math.min(maxTimeoutMs, deadlineAt - Date.now()));
}

export async function withGitHubOperationTimeout<T>(
	label: string,
	timeoutMs: number,
	task: (signal: AbortSignal) => Promise<T>,
) {
	if (timeoutMs <= 0) {
		throw new GitHubOperationTimeoutError(label, timeoutMs);
	}

	const controller = new AbortController();
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	const taskPromise = task(controller.signal);
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			controller.abort();
			reject(new GitHubOperationTimeoutError(label, timeoutMs));
		}, timeoutMs);
	});

	try {
		return await Promise.race([taskPromise, timeoutPromise]);
	} finally {
		taskPromise.catch(() => {});
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		controller.abort();
	}
}

export async function executeGitHubGraphQL<TResponse>(
	context: GitHubContext,
	label: string,
	query: string,
	variables: Record<string, unknown>,
) {
	return withGitHubOperationTimeout(
		label,
		GITHUB_OPERATION_TIMEOUT_MS,
		(signal) =>
			context.octokit.graphql<TResponse>(query, {
				...variables,
				request: { signal },
			}),
	);
}

const requestScopedGitHubContextCache = new WeakMap<
	Request,
	Map<string, Promise<GitHubContext | null>>
>();

async function getRequestScopedContextCache() {
	try {
		const { getRequest } = await import("@tanstack/react-start/server");
		const request = getRequest();
		let cache = requestScopedGitHubContextCache.get(request);
		if (!cache) {
			cache = new Map();
			requestScopedGitHubContextCache.set(request, cache);
		}
		return cache;
	} catch {
		return null;
	}
}

export async function getOrCreateCachedContext(
	cacheKey: string,
	factory: () => Promise<GitHubContext | null>,
): Promise<GitHubContext | null> {
	const cache = await getRequestScopedContextCache();
	const existing = cache?.get(cacheKey);
	if (existing) {
		debug("github-access", "reusing cached context", { cacheKey });
		return existing;
	}

	const promise = factory();
	cache?.set(cacheKey, promise);
	return promise;
}

export async function getGitHubContext(): Promise<GitHubContext | null> {
	return getOrCreateCachedContext("base", async () => {
		const { getGitHubClientByUserId, getRequestSession } = await import(
			"../auth-runtime"
		);
		const session = await getRequestSession();
		if (!session) {
			debug("github-access", "no session, unauthenticated request");
			return null;
		}

		debug("github-access", "session found", { userId: session.user.id });
		try {
			return {
				session,
				octokit: await getGitHubClientByUserId(session.user.id),
			};
		} catch (error) {
			console.error("[github-access] failed to create GitHub client", error);
			return null;
		}
	});
}

export async function fetchGitHubResource<TGitHubData, TResult>({
	context,
	resource,
	params,
	request,
	mapData,
}: {
	context: GitHubContext;
	resource: string;
	params: unknown;
	request: (signal: AbortSignal) => Promise<GitHubRestResponse<TGitHubData>>;
	mapData: (data: TGitHubData) => TResult;
}) {
	return dedupeGitHubRead<TResult>({
		userId: context.session.user.id,
		resource,
		params,
		fetcher: async () => {
			const response = await withGitHubOperationTimeout(
				`github ${resource}`,
				GITHUB_OPERATION_TIMEOUT_MS,
				request,
			);
			return mapData(response.data);
		},
	});
}

export async function fetchPaginatedGitHubResource<TGitHubItem, TResult>({
	context,
	resource,
	params,
	request,
	mapData,
	pageSize = 100,
}: {
	context: GitHubContext;
	resource: string;
	params: unknown;
	request: (
		page: number,
		signal: AbortSignal,
	) => Promise<GitHubRestResponse<TGitHubItem[]>>;
	mapData: (items: TGitHubItem[]) => TResult;
	pageSize?: number;
}) {
	return dedupeGitHubRead<TResult>({
		userId: context.session.user.id,
		resource,
		params,
		fetcher: async () =>
			mapData(
				await listPaginatedGitHubItems({
					request,
					getItems: (data) => data as TGitHubItem[],
					label: `github ${resource}`,
					pageSize,
				}),
			),
	});
}

export async function listPaginatedGitHubItems<TItem>({
	request,
	getItems,
	label = "github paginated items",
	pageSize = 100,
}: {
	request: (
		page: number,
		signal: AbortSignal,
	) => Promise<GitHubRestResponse<unknown>>;
	getItems: (data: unknown) => TItem[];
	label?: string;
	pageSize?: number;
}) {
	const items: TItem[] = [];
	let page = 1;
	const deadlineAt = Date.now() + GITHUB_PAGINATED_OPERATION_TIMEOUT_MS;

	while (true) {
		const timeoutMs = getRemainingSearchTimeoutMs(
			deadlineAt,
			GITHUB_OPERATION_TIMEOUT_MS,
		);
		if (timeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
			throw new GitHubOperationTimeoutError(`${label} page ${page}`, timeoutMs);
		}

		const response = await withGitHubOperationTimeout(
			`${label} page ${page}`,
			timeoutMs,
			(signal) => request(page, signal),
		);
		const pageItems = getItems(response.data);
		items.push(...pageItems);

		if (pageItems.length < pageSize) {
			break;
		}

		page += 1;
	}

	return items;
}

export async function getViewer(
	context: GitHubContext,
): Promise<AuthenticatedUser> {
	return fetchGitHubResource<AuthenticatedUser, AuthenticatedUser>({
		context,
		resource: "viewer",
		params: null,
		request: () => context.octokit.rest.users.getAuthenticated({}),
		mapData: (viewer) => viewer,
	});
}

export async function resolveUsername(
	context: GitHubContext,
	username?: string,
) {
	if (username) {
		return username;
	}

	const viewer = await getViewer(context);
	return viewer.login;
}
