import { createClientOnlyFn } from "@tanstack/react-start";
import { normalizeAuthRedirect } from "./auth-redirect";
import { buildGitHubAppAuthorizePath } from "./github-access";

export type GitHubSignInMode = "social" | "emulator";

export const signInWithGitHub = createClientOnlyFn(
	async ({
		redirect,
		mode = "social",
	}: {
		redirect?: string;
		mode?: GitHubSignInMode;
	} = {}) => {
		const { clearProtectedRouteCachedAuth } = await import(
			"./protected-auth-cache"
		);
		// Whoever signs in next must not be painted as the previous viewer.
		clearProtectedRouteCachedAuth();

		const callbackURL = normalizeAuthRedirect(redirect);
		if (mode === "emulator") {
			// Demo mode: chain straight into the GitHub App authorization so the
			// app-user token exists before the setup gate. The emulator skips its
			// account picker on that second hop.
			const response = await fetch("/api/auth/sign-in/oauth2", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					providerId: "github",
					callbackURL: buildGitHubAppAuthorizePath(callbackURL),
				}),
			});
			const { url } = (await response.json().catch(() => ({}))) as {
				url?: string;
			};
			if (!response.ok || !url) {
				throw new Error(
					"Demo sign-in failed: is the GitHub emulator running (pnpm dev:demo)?",
				);
			}
			window.location.href = url;
			return;
		}
		const { signIn } = await import("./auth.client");
		return signIn.social({
			provider: "github",
			callbackURL,
		});
	},
);

export const signOutToLogin = createClientOnlyFn(async () => {
	const [{ signOut }, { getProtectedRouteCachedAuth }, { clearLocalSession }] =
		await Promise.all([
			import("./auth.client"),
			import("./protected-auth-cache"),
			import("./local-session"),
		]);
	const userId = getProtectedRouteCachedAuth()?.user.id ?? null;
	await signOut();
	await clearLocalSession(userId);
	window.location.href = "/login";
});
