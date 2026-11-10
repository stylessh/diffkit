export type SignInError = "cancelled" | "failed";

export function parseSignInError(value: unknown): SignInError | undefined {
	if (typeof value !== "string" || value === "") {
		return undefined;
	}
	return value === "access_denied" ? "cancelled" : "failed";
}

export const signInErrorMessages: Record<SignInError, string> = {
	cancelled: "Sign-in was cancelled on GitHub.",
	failed: "GitHub sign-in didn’t go through. Please try again.",
};

export function buildSignInErrorURL(redirect: string) {
	return `/login?${new URLSearchParams({ redirect })}`;
}
