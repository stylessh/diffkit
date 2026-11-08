import { describe, expect, it } from "vitest";
import { resolveGitHubEmulatorUrl } from "./github-emulator";

describe("resolveGitHubEmulatorUrl", () => {
	it("is off when the variable is unset or blank", () => {
		expect(resolveGitHubEmulatorUrl(undefined, { isProduction: false })).toBe(
			null,
		);
		expect(resolveGitHubEmulatorUrl("  ", { isProduction: true })).toBe(null);
	});

	it("returns the emulator origin in development", () => {
		expect(
			resolveGitHubEmulatorUrl("http://localhost:4001/", {
				isProduction: false,
			}),
		).toBe("http://localhost:4001");
		expect(
			resolveGitHubEmulatorUrl("http://127.0.0.1:4001", {
				isProduction: false,
			}),
		).toBe("http://127.0.0.1:4001");
	});

	it("refuses to run in a production build", () => {
		expect(() =>
			resolveGitHubEmulatorUrl("http://localhost:4001", { isProduction: true }),
		).toThrow(/production build/);
	});

	it("only accepts loopback hosts", () => {
		expect(() =>
			resolveGitHubEmulatorUrl("https://api.github.com", {
				isProduction: false,
			}),
		).toThrow(/local emulator/);
		expect(() =>
			resolveGitHubEmulatorUrl("not a url", { isProduction: false }),
		).toThrow(/Invalid GITHUB_EMULATOR_URL/);
	});
});
