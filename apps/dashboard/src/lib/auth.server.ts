import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { getGitHubAppAuthConfig } from "./github-app.server";

export function getAuth() {
	const db = drizzle(env.DB, { schema });
	const github = getGitHubAppAuthConfig();

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		socialProviders: {
			github: {
				clientId: github.clientId,
				clientSecret: github.clientSecret,
			},
		},
		plugins: [tanstackStartCookies()],
	});
}
