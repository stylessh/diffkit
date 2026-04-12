import "@tanstack/react-start/server-only";
import { App, Octokit, type Octokit as OctokitType } from "octokit";
import {
	getGitHubAccessTokenByUserId,
	getGitHubAppId,
	getGitHubAppPrivateKey,
} from "./github-app.server";
import { configureGitHubRequestPolicies } from "./github-request-policy";

const GITHUB_CLIENT_USER_AGENT = "diffkit-dashboard";
const GITHUB_SECONDARY_RATE_LIMIT_FALLBACK_SECONDS = 60;

type GitHubThrottleRequestOptions = {
	method?: string;
	url: string;
};

type GitHubThrottleClient = Pick<OctokitType, "log">;

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
