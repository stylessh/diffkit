/**
 * Fixed identities for the local demo workspace.
 *
 * Every value here is a throwaway credential that only works against the local
 * emulator. `apps/dashboard/.dev.vars.demo` mirrors them, and a test keeps the
 * two files in sync.
 */
import { readFileSync } from "node:fs";

export const DEFAULT_EMULATOR_PORT = 4001;
export const DEFAULT_DASHBOARD_URL = "http://localhost:3000";

/** The person you sign in as. Most seeded activity revolves around them. */
export const DEMO_VIEWER_LOGIN = "nova";
export const DEMO_ORG_LOGIN = "lumen-labs";

/** Seed-only token used by the content seeder to act as the emulator admin. */
export const SEED_ADMIN_TOKEN = "demo_seed_admin";

export function seedTokenFor(login: string) {
	return `demo_seed_${login.replaceAll("-", "_")}`;
}

/** OAuth App used by Better Auth for sign-in (`GITHUB_OAUTH_CLIENT_*`). */
export const DEMO_OAUTH_APP = {
	clientId: "Ov23liDemoDiffKitOAuth",
	clientSecret: "demo-oauth-client-secret-not-a-real-secret",
	name: "DiffKit (local demo)",
};

/**
 * GitHub App used for installation tokens, app-user tokens and webhooks
 * (`GITHUB_APP_*`). The private key below was generated once for the demo and
 * committed on purpose: it only signs JWTs the local emulator accepts.
 */
export const DEMO_GITHUB_APP = {
	appId: 424_242,
	slug: "diffkit-demo",
	name: "DiffKit Demo",
	clientId: "Iv1.demodiffkitapp",
	clientSecret: "demo-app-client-secret-not-a-real-secret",
	webhookSecret: "demo-webhook-secret-not-a-real-secret",
	privateKey: readFileSync(
		new URL("./demo-github-app.private-key.pem", import.meta.url),
		"utf8",
	),
};

export const DEMO_INSTALLATION_IDS = {
	org: 7001,
	viewer: 7002,
} as const;

export function oauthRedirectUris(dashboardUrl: string) {
	return {
		signIn: [
			`${dashboardUrl}/api/auth/callback/github`,
			// Better Auth's generic OAuth plugin (used in demo mode) calls back here.
			`${dashboardUrl}/api/auth/oauth2/callback/github`,
		],
		app: [`${dashboardUrl}/api/github/app/callback`],
	};
}
