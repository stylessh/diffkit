import { createClientOnlyFn } from "@tanstack/react-start";

export const signInWithGitHub = createClientOnlyFn(async () => {
	const { signIn } = await import("./auth.client");
	return signIn.social({ provider: "github" });
});

export const signOutToLogin = createClientOnlyFn(async () => {
	const { signOut } = await import("./auth.client");
	await signOut();
	window.location.href = "/login";
});
