import "@tanstack/react-start/server-only";
import { Octokit, type Octokit as OctokitType } from "octokit";
import { getGitHubAccessTokenByUserId } from "./github-app.server";

export async function getGitHubClient(userId: string): Promise<OctokitType> {
	return new Octokit({
		auth: await getGitHubAccessTokenByUserId(userId),
		retry: { enabled: false },
		throttle: { enabled: false },
	});
}
