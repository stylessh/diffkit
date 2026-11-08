import { RequestError } from "octokit";
import { debug } from "../debug";
import {
	createGitHubResponseMetadata,
	type GitHubConditionalHeaders,
	type GitHubFetchResult,
	getOrRevalidateGitHubResource,
} from "../github-cache";
import { githubCachePolicy } from "../github-cache-policy";
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

export function buildConditionalHeaders(
	conditionals: GitHubConditionalHeaders,
) {
	const headers: Record<string, string> = {};

	if (conditionals.etag) {
		headers["if-none-match"] = conditionals.etag;
	}

	if (conditionals.lastModified) {
		headers["if-modified-since"] = conditionals.lastModified;
	}

	return headers;
}

export function normalizeResponseHeaders(headers: Record<string, unknown>) {
	return Object.entries(headers).reduce<Record<string, string | null>>(
		(accumulator, [key, value]) => {
			if (typeof value === "string") {
				accumulator[key.toLowerCase()] = value;
			} else if (typeof value === "number") {
				accumulator[key.toLowerCase()] = String(value);
			} else if (Array.isArray(value) && typeof value[0] === "string") {
				accumulator[key.toLowerCase()] = value[0];
			}

			return accumulator;
		},
		{},
	);
}

async function executeGitHubRequest<TData>(
	request: (
		headers: Record<string, string>,
		signal: AbortSignal,
	) => Promise<GitHubRestResponse<TData>>,
	conditionals: GitHubConditionalHeaders,
	label = "github request",
): Promise<GitHubFetchResult<TData>> {
	try {
		const response = await withGitHubOperationTimeout(
			label,
			GITHUB_OPERATION_TIMEOUT_MS,
			(signal) => request(buildConditionalHeaders(conditionals), signal),
		);

		return {
			kind: "success",
			data: response.data,
			metadata: createGitHubResponseMetadata(
				response.status,
				normalizeResponseHeaders(response.headers),
			),
		};
	} catch (error) {
		if (
			error instanceof RequestError &&
			error.status === 304 &&
			error.response?.headers
		) {
			return {
				kind: "not-modified",
				metadata: createGitHubResponseMetadata(
					304,
					normalizeResponseHeaders(
						error.response.headers as Record<string, unknown>,
					),
				),
			};
		}

		throw error;
	}
}

export async function getCachedGitHubRequest<TGitHubData, TResult>({
	context,
	resource,
	params,
	freshForMs,
	signalKeys,
	namespaceKeys,
	cacheMode,
	request,
	mapData,
}: {
	context: GitHubContext;
	resource: string;
	params: unknown;
	freshForMs: number;
	signalKeys?: string[];
	namespaceKeys?: string[];
	cacheMode?: "legacy" | "split";
	request: (
		headers: Record<string, string>,
		signal: AbortSignal,
	) => Promise<GitHubRestResponse<TGitHubData>>;
	mapData: (data: TGitHubData) => TResult;
}) {
	return getOrRevalidateGitHubResource<TResult>({
		userId: context.session.user.id,
		resource,
		params,
		freshForMs,
		signalKeys,
		namespaceKeys,
		cacheMode,
		fetcher: async (conditionals) => {
			const result = await executeGitHubRequest(
				request,
				conditionals,
				`github ${resource}`,
			);

			if (result.kind === "not-modified") {
				return result;
			}

			return {
				...result,
				data: mapData(result.data),
			};
		},
	});
}

export async function getCachedPaginatedGitHubRequest<TGitHubItem, TResult>({
	context,
	resource,
	params,
	freshForMs,
	signalKeys,
	namespaceKeys,
	cacheMode,
	request,
	mapData,
	pageSize = 100,
}: {
	context: GitHubContext;
	resource: string;
	params: unknown;
	freshForMs: number;
	signalKeys?: string[];
	namespaceKeys?: string[];
	cacheMode?: "legacy" | "split";
	request: (
		page: number,
		signal: AbortSignal,
	) => Promise<GitHubRestResponse<TGitHubItem[]>>;
	mapData: (items: TGitHubItem[]) => TResult;
	pageSize?: number;
}) {
	return getOrRevalidateGitHubResource<TResult>({
		userId: context.session.user.id,
		resource,
		params,
		freshForMs,
		signalKeys,
		namespaceKeys,
		cacheMode,
		fetcher: async () => {
			const items: TGitHubItem[] = [];
			let page = 1;
			let metadata = createGitHubResponseMetadata(200, {});
			const deadlineAt = Date.now() + GITHUB_PAGINATED_OPERATION_TIMEOUT_MS;

			while (true) {
				const timeoutMs = getRemainingSearchTimeoutMs(
					deadlineAt,
					GITHUB_OPERATION_TIMEOUT_MS,
				);
				if (timeoutMs < GITHUB_MIN_OPERATION_TIMEOUT_MS) {
					throw new GitHubOperationTimeoutError(
						`github ${resource} page ${page}`,
						timeoutMs,
					);
				}

				const response = await withGitHubOperationTimeout(
					`github ${resource} page ${page}`,
					timeoutMs,
					(signal) => request(page, signal),
				);
				if (page === 1) {
					metadata = createGitHubResponseMetadata(
						response.status,
						normalizeResponseHeaders(response.headers),
					);
				}

				items.push(...response.data);
				if (response.data.length < pageSize) {
					break;
				}

				page += 1;
			}

			return {
				kind: "success",
				data: mapData(items),
				metadata,
			};
		},
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
	return getCachedGitHubRequest<AuthenticatedUser, AuthenticatedUser>({
		context,
		resource: "viewer",
		params: null,
		freshForMs: githubCachePolicy.viewer.staleTimeMs,
		namespaceKeys: ["viewer"],
		cacheMode: "split",
		request: (headers) =>
			context.octokit.rest.users.getAuthenticated({ headers }),
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
