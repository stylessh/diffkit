import { describe, expect, it } from "vitest";
import { toClientSession } from "./auth-session";

describe("toClientSession", () => {
	it("keeps the viewer and session identity and drops the token, IP address and user agent", () => {
		const expiresAt = new Date("2026-12-01T00:00:00.000Z");

		const betterAuthSession = {
			user: {
				id: "user-1",
				name: "Ada",
				email: "ada@example.test",
				image: "https://avatars.example.test/ada.png",
				emailVerified: true,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-02T00:00:00.000Z"),
			},
			session: {
				id: "session-1",
				expiresAt,
				token: "raw-session-token",
				ipAddress: "203.0.113.7",
				userAgent: "Mozilla/5.0",
				userId: "user-1",
				createdAt: new Date("2026-11-01T00:00:00.000Z"),
				updatedAt: new Date("2026-11-01T00:00:00.000Z"),
			},
		};

		const result = toClientSession(betterAuthSession);

		expect(result).toEqual({
			user: {
				id: "user-1",
				name: "Ada",
				email: "ada@example.test",
				image: "https://avatars.example.test/ada.png",
			},
			session: { id: "session-1", expiresAt },
		});
		expect(JSON.stringify(result)).not.toContain("raw-session-token");
	});

	it("is null when there is no session", () => {
		expect(toClientSession(null)).toBeNull();
	});
});
