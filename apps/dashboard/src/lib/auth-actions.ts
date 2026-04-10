import { createClientOnlyFn } from "@tanstack/react-start";
import { normalizeAuthRedirect } from "./auth-redirect";

export const signInWithGitHub = createClientOnlyFn(
	async ({ redirect }: { redirect?: string } = {}) => {
		const { signIn } = await import("./auth.client");
		return signIn.social({
			provider: "github",
			callbackURL: normalizeAuthRedirect(redirect),
		});
	},
);

export const signOutToLogin = createClientOnlyFn(async () => {
	const { signOut } = await import("./auth.client");
	await signOut();
	window.location.href = "/login";
});
