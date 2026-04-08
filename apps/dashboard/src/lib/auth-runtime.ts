import { env } from "cloudflare:workers";
import { getRequest } from "@tanstack/react-start/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Octokit as OctokitType } from "octokit";
import { Octokit } from "octokit";
import { getDb } from "../db";
import * as schema from "../db/schema";
import { account } from "../db/schema";

const authDb = drizzle(env.DB, { schema });

function createAuth() {
	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(authDb, {
			provider: "sqlite",
		}),
		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
				scope: [
					"read:user",
					"user:email",
					"repo",
					"notifications",
					"workflow",
					"read:project",
					"security_events",
					"admin:repo_hook",
				],
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
	const db = getDb();
	const githubAccount = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "github")))
		.get();

	if (!githubAccount?.accessToken) {
		throw new Error("No GitHub account linked");
	}

	return new Octokit({
		auth: githubAccount.accessToken,
		retry: { enabled: false },
		throttle: { enabled: false },
	});
}
