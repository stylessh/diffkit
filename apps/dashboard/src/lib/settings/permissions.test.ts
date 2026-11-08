import { describe, expect, it } from "vitest";
import { repoSettingsCapabilities } from "./permissions";

describe("repoSettingsCapabilities", () => {
	it("limits triage to labels and reserves the rest for admins", () => {
		expect(repoSettingsCapabilities("TRIAGE")).toEqual({
			openSettings: true,
			manageLabels: true,
			administer: false,
		});
		expect(repoSettingsCapabilities("MAINTAIN").administer).toBe(false);
		expect(repoSettingsCapabilities("ADMIN").administer).toBe(true);
	});

	it("grants nothing to readers or an unknown permission", () => {
		for (const permission of ["READ", null] as const) {
			expect(repoSettingsCapabilities(permission)).toEqual({
				openSettings: false,
				manageLabels: false,
				administer: false,
			});
		}
	});
});
