import { describe, expect, it } from "vitest";
import {
	applySecurityHeaders,
	SECURITY_HEADERS,
	unhandledErrorResponse,
} from "./security-headers.server";

describe("applySecurityHeaders", () => {
	it("adds every header in place", () => {
		const response = new Response("ok");
		const result = applySecurityHeaders(response);
		expect(result).toBe(response);
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			expect(result.headers.get(name)).toBe(value);
		}
	});

	it("covers clickjacking, sniffing, referrer and HSTS", () => {
		expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
		expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
		expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain(
			"includeSubDomains",
		);
	});

	it("copies instead of throwing when the headers are immutable", () => {
		const redirect = Response.redirect("https://diffkit.test/login", 302);
		expect(() => redirect.headers.set("X-Test", "1")).toThrow();

		const result = applySecurityHeaders(redirect);

		expect(result.status).toBe(302);
		expect(result.headers.get("Location")).toBe("https://diffkit.test/login");
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			expect(result.headers.get(name)).toBe(value);
		}
	});

	it("keeps the body and status when it has to copy", async () => {
		const guarded = new Response("payload", { status: 201 });
		Object.defineProperty(guarded.headers, "set", {
			value: () => {
				throw new TypeError("immutable");
			},
		});
		const result = applySecurityHeaders(guarded);
		expect(result.status).toBe(201);
		expect(await result.text()).toBe("payload");
		expect(result.headers.get("X-Frame-Options")).toBe("DENY");
	});
});

describe("unhandledErrorResponse", () => {
	it("is a retryable JSON 503 for API paths", async () => {
		const response = unhandledErrorResponse("/api/changes");
		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("5");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.json()).toEqual({ error: "service_unavailable" });
	});

	it("is a plain-text 503 for pages", async () => {
		const response = unhandledErrorResponse("/pulls");
		expect(response.status).toBe(503);
		expect(response.headers.get("Content-Type")).toContain("text/plain");
		expect(await response.text()).toMatch(/temporarily unavailable/i);
	});
});
