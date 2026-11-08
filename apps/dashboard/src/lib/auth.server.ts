import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import {
	GITHUB_OAUTH_PROVIDER_ID,
	getGitHubOAuthConfig,
} from "./github-app.server";
import { getGitHubEmulatorUrl } from "./github-emulator.server";

const GITHUB_OAUTH_SCOPES = ["repo", "read:org", "user:email"];

type GitHubProfile = {
	id: number;
	login: string;
	name: string | null;
	email: string | null;
	avatar_url: string;
};

type GitHubEmail = { email: string; primary: boolean; verified: boolean };

/**
 * Better Auth's built-in GitHub provider hard-codes github.com, so demo mode
 * signs in through the generic OAuth plugin with the same provider id
 * ("github") and the same user mapping. Accounts stay compatible with
 * `getGitHubAccessTokenByUserId`.
 */
function emulatorGitHubProvider(
	emulatorUrl: string,
	credentials: { clientId: string; clientSecret: string },
): BetterAuthPlugin {
	const githubFetch = async <T>(path: string, accessToken: string) => {
		const response = await fetch(`${emulatorUrl}${path}`, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${accessToken}`,
				"User-Agent": "better-auth",
			},
		});
		return response.ok ? ((await response.json()) as T) : null;
	};

	return genericOAuth({
		config: [
			{
				providerId: GITHUB_OAUTH_PROVIDER_ID,
				clientId: credentials.clientId,
				clientSecret: credentials.clientSecret,
				authorizationUrl: `${emulatorUrl}/login/oauth/authorize`,
				tokenUrl: `${emulatorUrl}/login/oauth/access_token`,
				userInfoUrl: `${emulatorUrl}/user`,
				authentication: "post",
				scopes: ["read:user", ...GITHUB_OAUTH_SCOPES],
				async getUserInfo(tokens) {
					const accessToken = tokens.accessToken;
					if (!accessToken) {
						return null;
					}
					const profile = await githubFetch<GitHubProfile>(
						"/user",
						accessToken,
					);
					if (!profile) {
						return null;
					}
					const emails =
						(await githubFetch<GitHubEmail[]>("/user/emails", accessToken)) ??
						[];
					const email =
						profile.email ??
						(emails.find((entry) => entry.primary) ?? emails[0])?.email ??
						null;
					return {
						id: String(profile.id),
						name: profile.name || profile.login || "",
						email,
						image: profile.avatar_url,
						emailVerified:
							emails.find((entry) => entry.email === email)?.verified ?? false,
					};
				},
			},
		],
	});
}

export function getAuth() {
	const db = drizzle(env.DB, { schema });
	const github = getGitHubOAuthConfig();
	const emulatorUrl = getGitHubEmulatorUrl();

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, {
			provider: "sqlite",
		}),
		...(emulatorUrl
			? {}
			: {
					socialProviders: {
						github: {
							clientId: github.clientId,
							clientSecret: github.clientSecret,
							scope: GITHUB_OAUTH_SCOPES,
						},
					},
				}),
		plugins: [
			...(emulatorUrl ? [emulatorGitHubProvider(emulatorUrl, github)] : []),
			tanstackStartCookies(),
		],
	});
}
