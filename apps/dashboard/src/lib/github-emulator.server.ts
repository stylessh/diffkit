import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";
import { resolveGitHubEmulatorUrl } from "./github-emulator";

/**
 * Local demo mode (`pnpm dev:demo`): when `GITHUB_EMULATOR_URL` is set, every
 * GitHub API call, OAuth hop and App token exchange goes to the local
 * emulator in `apps/emulator` instead of github.com. Unset, nothing changes.
 */

const GITHUB_WEB_ORIGIN = "https://github.com";

export function getGitHubEmulatorUrl(): string | null {
	return resolveGitHubEmulatorUrl(
		(env as { GITHUB_EMULATOR_URL?: string }).GITHUB_EMULATOR_URL,
		{ isProduction: import.meta.env.PROD },
	);
}

export function isGitHubEmulatorEnabled() {
	return getGitHubEmulatorUrl() !== null;
}

/** Spread into Octokit options; empty (github.com defaults) unless demo mode is on. */
export function getGitHubOctokitBaseOptions(): { baseUrl?: string } {
	const emulatorUrl = getGitHubEmulatorUrl();
	return emulatorUrl ? { baseUrl: emulatorUrl } : {};
}

/** Origin for the OAuth web flow (`/login/oauth/*`). */
export function getGitHubOAuthOrigin() {
	return getGitHubEmulatorUrl() ?? GITHUB_WEB_ORIGIN;
}
