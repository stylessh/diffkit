import { env } from "cloudflare:workers";
import { getRequest } from "@tanstack/react-start/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import type { Octokit as OctokitType } from "octokit";
import { Octokit } from "octokit";
import * as schema from "../db/schema";
import {
	getGitHubAccessTokenByUserId,
	getGitHubOAuthConfig,
} from "./github-app.server";

const authDb = drizzle(env.DB, { schema });

function createAuth() {
	const github = getGitHubOAuthConfig();

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(authDb, {
			provider: "sqlite",
		}),
		socialProviders: {
			github: {
				clientId: github.clientId,
				clientSecret: github.clientSecret,
				scope: ["repo", "user:email"],
			},
		},
		plugins: [tanstackStartCookies()],
	});
}

let authInstance: ReturnType<typeof createAuth> | undefined;

function getAuth() {
	if (!authInstance) {
		authInstance = createAuth();
	}

	return authInstance;
}

export async function getRequestSession() {
	return getAuth().api.getSession({ headers: getRequest().headers });
}

export async function getGitHubClientByUserId(
	userId: string,
): Promise<OctokitType> {
	return new Octokit({
		auth: await getGitHubAccessTokenByUserId(userId),
		retry: { enabled: false },
		throttle: { enabled: false },
	});
}
