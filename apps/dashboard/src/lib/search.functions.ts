import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type {
	SearchCodeInput,
	SearchCodeResponse,
	SearchOnboardRepoInput,
	SearchOnboardRepoResponse,
	SearchRepoStatusResponse,
} from "./search.types";

type SearchFetchErrorPayload = {
	error?: string;
	message?: string;
	trace_id?: string;
};

function getRequestBaseUrl(request: Request) {
	const url = new URL(request.url);
	return `${url.protocol}//${url.host}`;
}

async function parseSearchResponse<T>(response: Response): Promise<T> {
	if (response.ok) {
		return (await response.json()) as T;
	}

	let payload: SearchFetchErrorPayload | null = null;
	try {
		payload = (await response.json()) as SearchFetchErrorPayload;
	} catch {
		payload = null;
	}
	const message = payload?.error || payload?.message || "Search request failed";
	throw new Error(message);
}

function isLivegrepBaseUrlUnsetMessage(message: string) {
	return message.includes("LIVEGREP_BASE_URL is not configured");
}

export const searchCode = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<SearchCodeInput>)
	.handler(async ({ data }): Promise<SearchCodeResponse> => {
		const request = getRequest();

		const endpoint = new URL("/api/search", getRequestBaseUrl(request));
		endpoint.searchParams.set("q", data.q);
		if (data.repo) endpoint.searchParams.set("repo", data.repo);
		if (data.path) endpoint.searchParams.set("path", data.path);
		if (data.lang) endpoint.searchParams.set("lang", data.lang);
		if (data.page) endpoint.searchParams.set("page", data.page);

		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				cookie: request.headers.get("cookie") ?? "",
				Accept: "application/json",
			},
		});

		if (response.ok) {
			return (await response.json()) as SearchCodeResponse;
		}

		let payload: SearchFetchErrorPayload | null = null;
		try {
			payload = (await response.json()) as SearchFetchErrorPayload;
		} catch {
			payload = null;
		}
		const message =
			payload?.error || payload?.message || "Search request failed";
		if (response.status >= 500 && isLivegrepBaseUrlUnsetMessage(message)) {
			return {
				results: [],
				repo_status: {},
				partial: false,
				trace_id: payload?.trace_id ?? "code-search-disabled",
				code_search_disabled: true,
			};
		}

		throw new Error(message);
	});

export const onboardSearchRepo = createServerFn({ method: "POST" })
	.inputValidator(identityValidator<SearchOnboardRepoInput>)
	.handler(async ({ data }): Promise<SearchOnboardRepoResponse> => {
		const request = getRequest();

		const endpoint = new URL("/api/search/repos", getRequestBaseUrl(request));
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				cookie: request.headers.get("cookie") ?? "",
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		});
		return parseSearchResponse<SearchOnboardRepoResponse>(response);
	});

export const getSearchRepoStatus = createServerFn({ method: "GET" })
	.inputValidator(identityValidator<{ repoId: string }>)
	.handler(async ({ data }): Promise<SearchRepoStatusResponse> => {
		const request = getRequest();

		const endpoint = new URL(
			`/api/search/repos/${encodeURIComponent(data.repoId)}/status`,
			getRequestBaseUrl(request),
		);
		const response = await fetch(endpoint, {
			method: "GET",
			headers: {
				cookie: request.headers.get("cookie") ?? "",
				Accept: "application/json",
			},
		});
		return parseSearchResponse<SearchRepoStatusResponse>(response);
	});

function identityValidator<TInput>(data: TInput) {
	return data;
}
