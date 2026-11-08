/**
 * Fixed identities for the local demo workspace.
 *
 * Every value here is a throwaway credential that only works against the local
 * emulator. `apps/dashboard/.dev.vars.demo` mirrors them, and a test keeps the
 * two files in sync.
 */
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

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

const DEMO_APP_KEY_PATH = new URL(
	"../../.emulate/demo-github-app.private-key.pem",
	import.meta.url,
);

/**
 * Throwaway RSA key the demo GitHub App signs JWTs with. Generated on first
 * run and kept in the gitignored `.emulate/` directory, so no private key is
 * committed. The dashboard fetches it from the emulator in demo mode.
 */
function loadDemoAppPrivateKey() {
	if (existsSync(DEMO_APP_KEY_PATH)) {
		return readFileSync(DEMO_APP_KEY_PATH, "utf8");
	}
	const { privateKey } = generateKeyPairSync("rsa", {
		modulusLength: 2048,
		privateKeyEncoding: { type: "pkcs1", format: "pem" },
		publicKeyEncoding: { type: "pkcs1", format: "pem" },
	});
	mkdirSync(new URL("./", DEMO_APP_KEY_PATH), { recursive: true });
	writeFileSync(DEMO_APP_KEY_PATH, privateKey, { mode: 0o600 });
	return privateKey;
}

/**
 * GitHub App used for installation tokens, app-user tokens and webhooks
 * (`GITHUB_APP_*`). Every value only works against the local emulator.
 */
export const DEMO_GITHUB_APP = {
	appId: 424_242,
	slug: "diffkit-demo",
	name: "DiffKit Demo",
	clientId: "Iv1.demodiffkitapp",
	clientSecret: "demo-app-client-secret-not-a-real-secret",
	webhookSecret: "demo-webhook-secret-not-a-real-secret",
	privateKey: loadDemoAppPrivateKey(),
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
