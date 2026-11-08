import { createServerFn } from "@tanstack/react-start";
import type { GitHubSignInMode } from "./auth-actions";

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const { getRequestSession } = await import("./auth-runtime");
		return getRequestSession();
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
