export type PullDiffParams = { owner: string; repo: string; number: number };

export type PullDiffRefusal =
	| "too_large"
	| "not_found"
	| "forbidden"
	| "unauthorized";

export type ApiDiffResult =
	| { kind: "diff"; body: ReadableStream<Uint8Array> }
	| { kind: "unauthenticated" };

export type PullDiffRequestDeps = {
	/** GitHub's REST diff media type. Throws octokit `RequestError`s. */
	fetchApiDiff: (
		params: PullDiffParams,
		signal: AbortSignal,
	) => Promise<ApiDiffResult>;
	/** github.com's public `.diff` URL, which has no file limit; null in demo mode. */
	fetchPublicDiff:
		| ((params: PullDiffParams, signal: AbortSignal) => Promise<Response>)
		| null;
};

const NAME_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/u;
const NUMBER_PATTERN = /^[1-9][0-9]{0,9}$/u;

export function parsePullDiffParams(url: URL): PullDiffParams | null {
	const owner = url.searchParams.get("owner") ?? "";
	const repo = url.searchParams.get("repo") ?? "";
	const number = url.searchParams.get("number") ?? "";
	if (
		!NAME_PATTERN.test(owner) ||
		!NAME_PATTERN.test(repo) ||
		!NUMBER_PATTERN.test(number)
	) {
		return null;
	}
	return { owner, repo, number: Number(number) };
}

type RequestErrorLike = {
	status?: unknown;
	response?: { data?: unknown };
};

function errorCodes(data: unknown): string[] {
	if (typeof data !== "object" || data === null || !("errors" in data)) {
		return [];
	}
	const { errors } = data as { errors?: unknown };
	return Array.isArray(errors)
		? errors.flatMap((entry) =>
				typeof entry === "object" && entry !== null && "code" in entry
					? [String((entry as { code: unknown }).code)]
					: [],
			)
		: [];
}

/** Maps a GitHub refusal to a reason the client can act on; null means unexpected. */
export function classifyPullDiffError(error: unknown): PullDiffRefusal | null {
	if (typeof error !== "object" || error === null) return null;
	const { status, response } = error as RequestErrorLike;
	// GitHub answers 406 when the diff media type exceeds its file or line limits.
	if (status === 406 || status === 413) return "too_large";
	if (status === 422 && errorCodes(response?.data).includes("too_large")) {
		return "too_large";
	}
	if (status === 404) return "not_found";
	if (status === 403) return "forbidden";
	if (status === 401) return "unauthorized";
	return null;
}

const REFUSAL_STATUS: Record<PullDiffRefusal, number> = {
	too_large: 413,
	not_found: 404,
	forbidden: 403,
	unauthorized: 401,
};

function refusal(reason: PullDiffRefusal) {
	return Response.json(
		{ reason },
		{
			status: REFUSAL_STATUS[reason],
			headers: { "Cache-Control": "private, no-store" },
		},
	);
}

function diffResponse(
	body: ReadableStream<Uint8Array>,
	source: "api" | "public",
) {
	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "private, no-store",
			"X-Diff-Source": source,
		},
	});
}

async function publicDiff(
	deps: PullDiffRequestDeps,
	params: PullDiffParams,
	signal: AbortSignal,
) {
	if (!deps.fetchPublicDiff) return null;
	const response = await deps.fetchPublicDiff(params, signal).catch(() => null);
	// Private repos and sign-in walls answer with HTML or a 404, never a diff.
	const isDiff =
		response?.ok === true &&
		response.body !== null &&
		(response.headers.get("Content-Type") ?? "").startsWith("text/plain");
	if (!isDiff) {
		await response?.body?.cancel().catch(() => {});
		return null;
	}
	return response.body;
}

export async function handlePullDiffRequest(
	request: Request,
	deps: PullDiffRequestDeps,
): Promise<Response> {
	const params = parsePullDiffParams(new URL(request.url));
	if (!params) {
		return Response.json({ reason: "invalid_request" }, { status: 400 });
	}
	try {
		const result = await deps.fetchApiDiff(params, request.signal);
		if (result.kind === "unauthenticated") return refusal("unauthorized");
		return diffResponse(result.body, "api");
	} catch (error) {
		const reason = classifyPullDiffError(error);
		if (reason === null) throw error;
		if (reason !== "too_large") return refusal(reason);
		const body = await publicDiff(deps, params, request.signal);
		return body ? diffResponse(body, "public") : refusal("too_large");
	}
}
