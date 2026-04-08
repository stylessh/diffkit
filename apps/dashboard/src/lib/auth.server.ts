import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export function getAuth() {
	const db = drizzle(env.DB, { schema });

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, {
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
