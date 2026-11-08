import { describe, expect, it } from "vitest";
import {
	normalizeActionsName,
	validateActionsName,
	validateActionsValue,
} from "./actions-config";

describe("validateActionsName", () => {
	it("accepts what GitHub accepts and stores it upper-cased", () => {
		expect(normalizeActionsName(" deploy_key ")).toBe("DEPLOY_KEY");
		expect(validateActionsName("deploy_key", [])).toBeNull();
	});

	it("rejects names GitHub rejects", () => {
		expect(validateActionsName("1KEY", [])).toMatch(/number/);
		expect(validateActionsName("MY-KEY", [])).toMatch(/underscores/);
		expect(validateActionsName("github_token", [])).toMatch(/GITHUB_/);
		expect(validateActionsName("  ", [])).toMatch(/name/);
	});

	it("treats names as case-insensitive when checking for duplicates", () => {
		expect(validateActionsName("api_key", ["API_KEY"])).toMatch(/in use/);
	});
});

describe("validateActionsValue", () => {
	it("measures bytes, not characters", () => {
		expect(validateActionsValue("é".repeat(30_000), "secret")).toMatch(/48 KB/);
		expect(validateActionsValue("é".repeat(20_000), "variable")).toBeNull();
		expect(validateActionsValue("", "secret")).toMatch(/secret value/);
	});
});
