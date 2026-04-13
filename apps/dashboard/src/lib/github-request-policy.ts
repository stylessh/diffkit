import { getRequest } from "@tanstack/react-start/server";
import type { Octokit as OctokitType } from "octokit";
import { debug } from "./debug";

export const GITHUB_REQUEST_TIMEOUT_MS = 12_000;

type GitHubRequestOptions = Parameters<
	OctokitType["hook"]["before"]
>[1] extends (options: infer Options) => unknown
	? Options & {
			method?: string;
			url?: string;
			request?: {
				retries?: number;
				signal?: AbortSignal;
			};
		}
	: never;
type GitHubRateLimitResponse = {
	status?: number;
	headers?: Record<string, string | number | undefined>;
};
type GitHubRateLimitError = {
	status?: number;
	response?: GitHubRateLimitResponse;
};
type GitHubRequestPolicyOptions = {
	tokenLabel?: string;
};

function createGitHubRequestTimeoutSignal(
	requestSignal: AbortSignal | undefined,
) {
	const timeoutSignal = AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS);
	if (!requestSignal) {
		return timeoutSignal;
	}

	return AbortSignal.any([requestSignal, timeoutSignal]);
}

/**
 * Returns the incoming HTTP request's abort signal when available.
 * When the client navigates away the signal fires, letting us cancel
 * in-flight GitHub requests instead of running them to completion.
 */
function getIncomingRequestSignal(): AbortSignal | undefined {
	try {
		return getRequest().signal;
	} catch {
		return undefined;
	}
}

function normalizeHeaderValue(value: string | number | undefined) {
	return typeof value === "number" ? String(value) : value;
}

function parseRateLimitReset(value: string | undefined) {
	if (!value) {
		return null;
	}

	const seconds = Number.parseInt(value, 10);
	if (!Number.isFinite(seconds)) {
		return null;
	}

	return new Date(seconds * 1_000).toISOString();
}

function logGitHubRateLimit({
	options,
	response,
	tokenLabel,
}: {
	options: GitHubRequestOptions;
	response: GitHubRateLimitResponse;
	tokenLabel: string;
}) {
	const headers = response.headers ?? {};
	const remaining = normalizeHeaderValue(headers["x-ratelimit-remaining"]);
	const limit = normalizeHeaderValue(headers["x-ratelimit-limit"]);
	const used = normalizeHeaderValue(headers["x-ratelimit-used"]);
	const reset = normalizeHeaderValue(headers["x-ratelimit-reset"]);
	const resource = normalizeHeaderValue(headers["x-ratelimit-resource"]);

	if (!remaining && !limit && !used && !reset) {
		return;
	}

	debug("github-rate-limit", "request completed", {
		token: tokenLabel,
		method: options.method,
		url: options.url,
		status: response.status,
		resource,
		limit: limit ? Number(limit) : null,
		remaining: remaining ? Number(remaining) : null,
		used: used ? Number(used) : null,
		resetAt: parseRateLimitReset(reset),
	});
}

export function configureGitHubRequestPolicies(
	octokit: OctokitType,
	options: GitHubRequestPolicyOptions = {},
) {
	const tokenLabel = options.tokenLabel ?? "unknown";

	octokit.hook.before("request", (options: GitHubRequestOptions) => {
		const requestOptions = options.request ?? {};
		options.request = requestOptions;
		requestOptions.signal ??= createGitHubRequestTimeoutSignal(
			getIncomingRequestSignal(),
		);
	});

	octokit.hook.after("request", (response, requestOptions) => {
		logGitHubRateLimit({
			options: requestOptions as GitHubRequestOptions,
			response: response as GitHubRateLimitResponse,
			tokenLabel,
		});
	});

	octokit.hook.error("request", (error, requestOptions) => {
		const rateLimitError = error as GitHubRateLimitError;
		if (rateLimitError.response) {
			logGitHubRateLimit({
				options: requestOptions as GitHubRequestOptions,
				response: rateLimitError.response,
				tokenLabel,
			});
		}

		throw error;
	});
}
