import { describe, expect, it } from "vitest";
import { isRecentPush, RECENT_PUSH_WINDOW_MS } from "./recent-push";

describe("isRecentPush", () => {
	const now = Date.parse("2026-11-08T12:00:00Z");

	it("includes pushes up to two hours old and excludes older ones", () => {
		expect(
			isRecentPush(new Date(now - RECENT_PUSH_WINDOW_MS).toISOString(), now),
		).toBe(true);
		expect(
			isRecentPush(
				new Date(now - RECENT_PUSH_WINDOW_MS - 1000).toISOString(),
				now,
			),
		).toBe(false);
	});

	it("does not treat an unparseable timestamp as recent", () => {
		expect(isRecentPush("", now)).toBe(false);
	});
});
