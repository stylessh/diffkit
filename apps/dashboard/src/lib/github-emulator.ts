/**
 * Validation for local demo mode's `GITHUB_EMULATOR_URL` (see
 * github-emulator.server.ts). Kept free of Worker imports so it is testable.
 */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function resolveGitHubEmulatorUrl(
	raw: string | undefined,
	{ isProduction }: { isProduction: boolean },
): string | null {
	const value = typeof raw === "string" ? raw.trim() : "";
	if (!value) {
		return null;
	}
	if (isProduction) {
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
