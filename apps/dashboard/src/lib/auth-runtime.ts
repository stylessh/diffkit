import { getRequest } from "@tanstack/react-start/server";
import type { Octokit as OctokitType } from "octokit";
import { Octokit } from "octokit";
import { getAuth } from "./auth.server";
import {
	getGitHubAccessTokenByUserId,
	getGitHubAppUserAccessTokenByUserId,
} from "./github-app.server";
import { configureGitHubRequestPolicies } from "./github-request-policy";

export async function getRequestSession() {
	return getAuth().api.getSession({ headers: getRequest().headers });
}

export async function getGitHubClientByUserId(
	userId: string,
): Promise<OctokitType> {
	const octokit = new Octokit({
		auth: await getGitHubAccessTokenByUserId(userId),
		retry: { enabled: false },
		throttle: { enabled: false },
	});

	configureGitHubRequestPolicies(octokit, {
		tokenLabel: `oauth:user:${userId}`,
	});

	return octokit;
}

export async function getGitHubAppUserClientByUserId(
	userId: string,
): Promise<OctokitType | null> {
	const token = await getGitHubAppUserAccessTokenByUserId(userId);
	if (!token) {
		return null;
	}

	const octokit = new Octokit({
		auth: token,
		retry: { enabled: false },
		throttle: { enabled: false },
	});

	configureGitHubRequestPolicies(octokit, {
		tokenLabel: `app-user:${userId}`,
	});

	return octokit;
}
