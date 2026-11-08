import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

const NOW = Date.parse("2026-11-08T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("formatRelativeTime", () => {
	it("drops the suffix and says now in compact mode", () => {
		const compact = (seconds: number) =>
			formatRelativeTime(ago(seconds), NOW, { compact: true });

		expect(compact(30)).toBe("now");
		expect(compact(59 * 60)).toBe("59m");
		expect(compact(60 * 60)).toBe("1h");
		expect(compact(29 * 86_400)).toBe("29d");
		expect(compact(30 * 86_400)).toBe("1mo");
		expect(compact(365 * 86_400)).toBe("1y");
	});

	it("keeps the long form by default", () => {
		expect(formatRelativeTime(ago(30), NOW)).toBe("just now");
		expect(formatRelativeTime(ago(2 * 3600), NOW)).toBe("2h ago");
		expect(formatRelativeTime("not a date", NOW)).toBe("—");
	});
});
