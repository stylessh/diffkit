import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "./security-headers.server";

describe("applySecurityHeaders", () => {
	it("copies instead of throwing when the headers are immutable", async () => {
		const redirect = Response.redirect("https://diffkit.test/login", 302);
		expect(() => redirect.headers.set("X-Test", "1")).toThrow();

		const result = applySecurityHeaders(redirect);

		expect(result.status).toBe(302);
		expect(result.headers.get("Location")).toBe("https://diffkit.test/login");
		expect(result.headers.get("X-Frame-Options")).toBe("DENY");
	});
});
