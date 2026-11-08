import { describe, expect, it } from "vitest";
import {
	changedOrgFields,
	mapOrgInvitation,
	mapOrgMembers,
	mapOrgSettings,
	mapOrgTeam,
	mapTeamMembers,
	orgDraftFromSettings,
	orgSettingsCapabilities,
	parseInvitee,
	toOrgApiPatch,
	validateOrgDraft,
	validateOrgTeamDraft,
} from "./org";

const raw = {
	login: "acme",
	avatar_url: "a",
	html_url: "https://github.com/acme",
	name: "Acme",
};

describe("organization profile", () => {
	const saved = orgDraftFromSettings(mapOrgSettings(raw));

	it("reads fields GitHub withholds from non-admins as defaults", () => {
		expect(saved).toMatchObject({
			defaultRepositoryPermission: "read",
			membersCanCreateRepositories: true,
			email: "",
		});
		expect(
			mapOrgSettings({ ...raw, default_repository_permission: "bogus" })
				.defaultRepositoryPermission,
		).toBe("read");
	});

	it("sends only changed, trimmed fields under GitHub's names", () => {
		const changes = changedOrgFields(saved, {
			...saved,
			location: " Berlin ",
			defaultRepositoryPermission: "none",
		});
		expect(toOrgApiPatch(changes)).toEqual({
			location: "Berlin",
			default_repository_permission: "none",
		});
		expect(changedOrgFields(saved, { ...saved, name: "Acme " })).toEqual({});
	});

	it("validates email and website", () => {
		expect(validateOrgDraft({ ...saved, email: "nope" })).toMatch(/email/);
		expect(validateOrgDraft({ ...saved, blog: "ftp://x" })).toMatch(/http/);
		expect(validateOrgDraft({ ...saved, email: "hi@acme.dev" })).toBeNull();
	});
});

describe("members", () => {
	it("marks owners from the admin listing and lists them first", () => {
		const members = mapOrgMembers(
			[
				{ login: "zed", avatar_url: "" },
				{ login: "Ann", avatar_url: "" },
				{ login: "bob", avatar_url: "" },
			],
			[{ login: "zed", avatar_url: "" }],
		);
		expect(members.map((m) => [m.login, m.role])).toEqual([
			["zed", "admin"],
			["Ann", "member"],
			["bob", "member"],
		]);
	});

	it("shows an invitation by login or email and skips empty ones", () => {
		expect(
			mapOrgInvitation({ id: 1, email: "c@x.dev", role: "admin" }),
		).toEqual({
			id: 1,
			label: "c@x.dev",
			role: "admin",
		});
		expect(mapOrgInvitation({ id: 2 })).toBeNull();
	});

	it("tells an email from a login and rejects anything else", () => {
		expect(parseInvitee("@octocat")).toEqual({
			kind: "login",
			login: "octocat",
		});
		expect(parseInvitee("a@b.co")).toEqual({ kind: "email", email: "a@b.co" });
		expect(parseInvitee("not valid!")).toBeNull();
		expect(parseInvitee("-bad")).toBeNull();
	});
});

describe("teams", () => {
	it("keeps counts optional because the list endpoint omits them", () => {
		expect(mapOrgTeam({ id: 1, slug: "a", name: "A" })).toMatchObject({
			membersCount: null,
			privacy: "closed",
		});
		expect(
			mapOrgTeam({
				id: 1,
				slug: "a",
				name: "A",
				privacy: "secret",
				members_count: 3,
			}),
		).toMatchObject({ membersCount: 3, privacy: "secret" });
	});

	it("rejects a duplicate team name regardless of case", () => {
		const draft = {
			name: "Runtime",
			description: "",
			privacy: "closed" as const,
		};
		expect(validateOrgTeamDraft(draft, ["runtime"])).toMatch(/already exists/);
		expect(validateOrgTeamDraft(draft, [])).toBeNull();
	});

	it("lists maintainers first", () => {
		const members = mapTeamMembers(
			[
				{ login: "b", avatar_url: "" },
				{ login: "a", avatar_url: "" },
			],
			[{ login: "b", avatar_url: "" }],
		);
		expect(members.map((m) => m.role)).toEqual(["maintainer", "member"]);
	});
});

describe("orgSettingsCapabilities", () => {
	it("lets only owners manage", () => {
		expect(orgSettingsCapabilities("admin").manage).toBe(true);
		expect(orgSettingsCapabilities("member").manage).toBe(false);
		expect(orgSettingsCapabilities(null).manage).toBe(false);
	});
});
