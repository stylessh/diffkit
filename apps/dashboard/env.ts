import { defineEnv, string, url } from "void/env";

// Every value the Worker reads. Locally they come from `.env` (copy
// env.example); in production from `void secret sync <file>`, and
// `void deploy` refuses to ship while a required one is missing.
export default defineEnv({
	// GitHub OAuth App: sign-in and broad-scope reads.
	GITHUB_OAUTH_CLIENT_ID: string(),
	GITHUB_OAUTH_CLIENT_SECRET: string(),
	// Older names for the OAuth App pair, read when the names above are unset.
	GITHUB_CLIENT_ID: string().optional(),
	GITHUB_CLIENT_SECRET: string().optional(),

	// GitHub App: installation tokens, webhooks, app-scoped repository access.
	GITHUB_APP_ID: string(),
	GITHUB_APP_SLUG: string(),
	GITHUB_APP_CLIENT_ID: string(),
	GITHUB_APP_CLIENT_SECRET: string(),
	// Demo mode fetches the emulator's key instead, so only production needs it.
	GITHUB_APP_PRIVATE_KEY: string().optional(),
	GITHUB_WEBHOOK_SECRET: string(),

	BETTER_AUTH_SECRET: string(),
	BETTER_AUTH_URL: url(),

	// Public base URL of the COMMENT_MEDIA bucket; uploads stay off without it.
	R2_PUBLIC_BASE_URL: url().optional(),
	// Demo mode only: base URL of apps/emulator.
	GITHUB_EMULATOR_URL: url().optional(),
});
