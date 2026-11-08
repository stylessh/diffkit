import { describe, expect, it } from "vitest";
import { normalizeAuthRedirect } from "./auth-redirect";

describe("normalizeAuthRedirect", () => {
	it("keeps relative app paths with search and hash", () => {
		expect(
			normalizeAuthRedirect("/stylessh/quickhub/pull.12?tab=files#comment-1"),
		).toBe("/stylessh/quickhub/pull.12?tab=files#comment-1");
	});

	it("falls back for missing or non-string values", () => {
		expect(normalizeAuthRedirect(undefined)).toBe("/");
		expect(normalizeAuthRedirect(123)).toBe("/");
	});

	it("rejects absolute and protocol-relative URLs", () => {
		expect(normalizeAuthRedirect("https://example.com/pulls")).toBe("/");
		expect(normalizeAuthRedirect("//example.com/pulls")).toBe("/");
	});

	it("rejects redirects back to login", () => {
		expect(normalizeAuthRedirect("/login")).toBe("/");
		expect(normalizeAuthRedirect("/login?redirect=/pulls")).toBe("/");
	});
});

describe("normalizeAuthRedirect: open-redirect attempts", () => {
	const attempts = [
		"/\\evil.com",
		"/\\\\evil.com",
		"/\t/evil.com",
		"/\n/evil.com",
		"/\r/evil.com",
		" //evil.com",
		"///evil.com",
		"/.//evil.com",
		"/..//evil.com",
		"/a/..//evil.com",
		"javascript:alert(1)",
		"\\\\evil.com",
		"https:evil.com",
		"",
	];

	it.each(attempts)("rejects %j", (attempt) => {
		const result = normalizeAuthRedirect(attempt);
		expect(result).toBe("/");
		expect(normalizeAuthRedirect(attempt, "/setup")).toBe("/setup");
	});

	it("keeps encoded slashes as path text rather than a host", () => {
		const result = normalizeAuthRedirect("/%2F%2Fevil.com");
		expect(result.startsWith("//")).toBe(false);
		expect(new URL(result, "https://app.test").origin).toBe("https://app.test");
	});

	it("uses the caller's fallback", () => {
		expect(normalizeAuthRedirect("https://evil.com", "/setup")).toBe("/setup");
		expect(normalizeAuthRedirect("/login", "/setup")).toBe("/setup");
		expect(normalizeAuthRedirect("/a?b=1#c", "/setup")).toBe("/a?b=1#c");
	});
});
