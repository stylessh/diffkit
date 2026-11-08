import "@tanstack/react-start/server-only";
import { env } from "cloudflare:workers";

/**
 * Local demo mode (`pnpm dev:demo`): when `GITHUB_EMULATOR_URL` is set, every
 * GitHub API call, OAuth hop and App token exchange goes to the local
 * emulator in `apps/emulator` instead of github.com. Unset, nothing changes.
 */

const GITHUB_WEB_ORIGIN = "https://github.com";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function getGitHubEmulatorUrl(): string | null {
	const raw = (env as { GITHUB_EMULATOR_URL?: string }).GITHUB_EMULATOR_URL;
	const value = typeof raw === "string" ? raw.trim() : "";
	if (!value) {
		return null;
	}
	if (import.meta.env.PROD) {
		throw new Error(
			"GITHUB_EMULATOR_URL is set in a production build. Demo mode is for local development only; remove the variable.",
		);
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error(
			`Invalid GITHUB_EMULATOR_URL ${JSON.stringify(value)}. Expected something like http://localhost:4001.`,
		);
	}
	if (!LOOPBACK_HOSTS.has(url.hostname)) {
		throw new Error(
			`GITHUB_EMULATOR_URL must point at a local emulator (localhost), got ${url.hostname}.`,
		);
	}
	return url.origin;
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
