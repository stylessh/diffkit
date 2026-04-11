import "@tanstack/react-start/server-only";
import { App, Octokit, type Octokit as OctokitType } from "octokit";
import {
	getGitHubAccessTokenByUserId,
	getGitHubAppId,
	getGitHubAppPrivateKey,
} from "./github-app.server";

const GITHUB_CLIENT_USER_AGENT = "quickhub-dashboard";
const GITHUB_READ_RETRY_COUNT = 2;
const GITHUB_RATE_LIMIT_RETRY_COUNT = 1;
const GITHUB_SECONDARY_RATE_LIMIT_FALLBACK_SECONDS = 60;

type GitHubThrottleRequestOptions = {
	method?: string;
	url: string;
};

type GitHubThrottleClient = Pick<OctokitType, "log">;

function isSafeGitHubRetryMethod(method: string | undefined) {
	return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function shouldRetryGitHubRateLimitedRequest({
	method,
	retryCount,
}: {
	method: string | undefined;
	retryCount: number;
}) {
	return (
		isSafeGitHubRetryMethod(method) &&
		retryCount < GITHUB_RATE_LIMIT_RETRY_COUNT
	);
}

function configureGitHubRequestPolicies(octokit: OctokitType) {
	octokit.hook.before("request", (options) => {
		const requestOptions = options.request ?? {};
		options.request = requestOptions;
		requestOptions.retries = isSafeGitHubRetryMethod(options.method)
			? GITHUB_READ_RETRY_COUNT
			: 0;
	});
}

export async function getGitHubClient(userId: string): Promise<OctokitType> {
	const octokit = new Octokit({
		auth: await getGitHubAccessTokenByUserId(userId),
		userAgent: GITHUB_CLIENT_USER_AGENT,
		retry: { enabled: true },
		throttle: {
			enabled: true,
			id: `github-user:${userId}`,
			fallbackSecondaryRateRetryAfter:
				GITHUB_SECONDARY_RATE_LIMIT_FALLBACK_SECONDS,
			onRateLimit: (
				retryAfter: number,
				options: GitHubThrottleRequestOptions,
				throttledOctokit: GitHubThrottleClient,
				retryCount: number,
			) => {
				throttledOctokit.log.warn(
					`GitHub rate limit for ${options.method} ${options.url}; retryAfter=${retryAfter}s retryCount=${retryCount}`,
				);

				if (
					shouldRetryGitHubRateLimitedRequest({
						method: options.method,
						retryCount,
					})
				) {
					throttledOctokit.log.info(
						`Retrying ${options.method} ${options.url} after ${retryAfter}s`,
					);
					return true;
				}

				return false;
			},
			onSecondaryRateLimit: (
				retryAfter: number,
				options: GitHubThrottleRequestOptions,
				throttledOctokit: GitHubThrottleClient,
				retryCount: number,
			) => {
				throttledOctokit.log.warn(
					`GitHub secondary rate limit for ${options.method} ${options.url}; retryAfter=${retryAfter}s retryCount=${retryCount}`,
				);

				if (
					shouldRetryGitHubRateLimitedRequest({
						method: options.method,
						retryCount,
					})
				) {
					throttledOctokit.log.info(
						`Retrying ${options.method} ${options.url} after secondary rate limit (${retryAfter}s)`,
					);
					return true;
				}

				return false;
			},
		},
	});

	configureGitHubRequestPolicies(octokit);

	return octokit;
}

export async function getGitHubInstallationClient(
	installationId: number,
): Promise<OctokitType> {
	const appId = getGitHubAppId();
	const privateKey = getGitHubAppPrivateKey();
	if (!appId || !privateKey) {
		throw new Error(
			"Missing GitHub App installation credentials. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.",
		);
	}

	const app = new App({
		appId,
		privateKey,
		Octokit,
	});
	const octokit = await app.getInstallationOctokit(installationId);

	configureGitHubRequestPolicies(octokit);

	return octokit;
}
