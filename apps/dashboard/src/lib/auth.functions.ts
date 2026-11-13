import { createServerFn } from "@tanstack/react-start";
import type { GitHubSignInMode } from "./auth-actions";
import { type ClientSession, toClientSession } from "./auth-session";

export const getSession = createServerFn({ method: "GET" }).handler(
	async (): Promise<ClientSession | null> => {
		const { getRequestSession } = await import("./auth-runtime");
		return toClientSession(await getRequestSession());
	},
);

/** "emulator" only when `GITHUB_EMULATOR_URL` is set (local demo mode). */
export const getGitHubSignInMode = createServerFn({ method: "GET" }).handler(
	async (): Promise<GitHubSignInMode> => {
		const { isGitHubEmulatorEnabled } = await import(
			"./github-emulator.server"
		);
		return isGitHubEmulatorEnabled() ? "emulator" : "social";
	},
);
