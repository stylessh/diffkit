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
