import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getDb } from "../db";
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

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? { ...value }
		: null;
}

function nullableString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function parseGitHubProfile(value: unknown): GitHubProfile | null {
	const record = asRecord(value);
	if (
		!record ||
		typeof record.id !== "number" ||
		typeof record.login !== "string"
	) {
		return null;
	}
	return {
		id: record.id,
		login: record.login,
		name: nullableString(record.name),
		email: nullableString(record.email),
		avatar_url: nullableString(record.avatar_url) ?? "",
	};
}

function parseGitHubEmails(value: unknown): GitHubEmail[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap((item: unknown) => {
		const record = asRecord(item);
		if (!record || typeof record.email !== "string") {
			return [];
		}
		return [
			{
				email: record.email,
				primary: record.primary === true,
				verified: record.verified === true,
			},
		];
	});
}

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
	const githubFetch = async (
		path: string,
		accessToken: string,
	): Promise<unknown> => {
		const response = await fetch(`${emulatorUrl}${path}`, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${accessToken}`,
				"User-Agent": "better-auth",
			},
		});
		return response.ok ? response.json() : null;
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
					const profile = parseGitHubProfile(
						await githubFetch("/user", accessToken),
					);
					if (!profile) {
						return null;
					}
					const emails = parseGitHubEmails(
						await githubFetch("/user/emails", accessToken),
					);
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

/**
 * Better Auth mounts its whole default API under /api/auth. DiffKit only
 * signs in with GitHub, reads the session and signs out, so every endpoint
 * that manages accounts, provider tokens, passwords or other sessions is
 * switched off. `auth.server.test.ts` fails when an upgrade adds an endpoint
 * that is neither used nor listed here.
 */
export const DISABLED_AUTH_PATHS = [
	"/get-access-token",
	"/refresh-token",
	"/account-info",
	"/list-accounts",
	"/link-social",
	"/oauth2/link",
	"/unlink-account",
	"/update-user",
	"/delete-user",
	"/delete-user/callback",
	"/change-email",
	"/verify-email",
	"/send-verification-email",
	"/sign-up/email",
	"/sign-in/email",
	"/change-password",
	"/verify-password",
	"/request-password-reset",
	"/reset-password",
	"/update-session",
	"/list-sessions",
	"/revoke-session",
	"/revoke-sessions",
	"/revoke-other-sessions",
];

export function getAuth() {
	const github = getGitHubOAuthConfig();
	const emulatorUrl = getGitHubEmulatorUrl();

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getDb(), {
			provider: "sqlite",
		}),
		// A DiffKit user is exactly one GitHub identity, found by GitHub account
		// id. Never attach a second GitHub account to a user by matching email.
		account: { accountLinking: { enabled: false } },
		disabledPaths: DISABLED_AUTH_PATHS,
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
