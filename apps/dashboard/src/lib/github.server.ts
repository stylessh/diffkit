import "@tanstack/react-start/server-only";
import { and, eq } from "drizzle-orm";
import { Octokit, type Octokit as OctokitType } from "octokit";
import { getDb } from "../db";
import { account } from "../db/schema";

export async function getGitHubClient(userId: string): Promise<OctokitType> {
	const db = getDb();

	const githubAccount = await db
		.select()
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, "github")))
		.get();

	if (!githubAccount?.accessToken) {
		throw new Error("No GitHub account linked");
	}

	return new Octokit({ auth: githubAccount.accessToken });
}
