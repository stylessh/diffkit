import { afterEach, describe, expect, it, vi } from "vitest";
import { isAppleTouchDevice } from "./apple-touch-device";

describe("isAppleTouchDevice", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("detects iPhone user agents", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
			platform: "iPhone",
			maxTouchPoints: 5,
		});
		expect(isAppleTouchDevice()).toBe(true);
	});

	it("detects iPadOS desktop-mode user agents", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
			platform: "MacIntel",
			maxTouchPoints: 5,
		});
		expect(isAppleTouchDevice()).toBe(true);
	});

	it("does not treat a desktop Mac as a touch device", () => {
		vi.stubGlobal("navigator", {
			userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
			platform: "MacIntel",
			maxTouchPoints: 0,
		});
		expect(isAppleTouchDevice()).toBe(false);
	});
});
