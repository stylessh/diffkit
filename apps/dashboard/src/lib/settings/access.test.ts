import { describe, expect, it } from "vitest";
import {
	mapCollaborator,
	mapInvitation,
	parseRole,
	sortCollaborators,
	toApiPermission,
} from "./access";

describe("role mapping", () => {
	it("maps the permission words the API uses in both directions", () => {
		expect(parseRole("pull")).toBe("read");
		expect(parseRole("push")).toBe("write");
		expect(parseRole("nope")).toBeNull();
		expect(toApiPermission("read")).toBe("pull");
		expect(toApiPermission("write")).toBe("push");
		expect(toApiPermission("maintain")).toBe("maintain");
	});
});

describe("mapCollaborator", () => {
	it("uses a built-in role name as is", () => {
		expect(
			mapCollaborator({ login: "ada", avatar_url: "a", role_name: "triage" }),
		).toMatchObject({ role: "triage", roleLabel: "Triage", status: "active" });
	});

	it("derives the closest built-in role for an organization's custom role", () => {
		expect(
			mapCollaborator({
				login: "bo",
				avatar_url: "b",
				role_name: "release-manager",
				permissions: { push: true, pull: true, triage: true },
			}),
		).toMatchObject({ role: "write", roleLabel: "release-manager" });
	});
});

describe("invitations", () => {
	it("keeps the invitation id so it can be revoked, and skips ghosts", () => {
		expect(
			mapInvitation({
				id: 9,
				invitee: { login: "cy", avatar_url: "c" },
				permissions: "write",
			}),
		).toMatchObject({ status: "pending", invitationId: 9, role: "write" });
		expect(mapInvitation({ id: 10, invitee: null })).toBeNull();
	});

	it("lists active people before pending invitations", () => {
		const sorted = sortCollaborators([
			mapInvitation({
				id: 1,
				invitee: { login: "aa", avatar_url: "" },
				permissions: "read",
			}) as never,
			mapCollaborator({ login: "zz", avatar_url: "", role_name: "read" }),
		]);
		expect(sorted.map((entry) => entry.login)).toEqual(["zz", "aa"]);
	});
});
