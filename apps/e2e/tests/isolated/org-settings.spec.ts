import { emulator } from "../../support/emulator.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

type Org = { location: string | null };
type Membership = { role: string };
type Invitation = { email: string | null; login: string | null };
type Team = { name: string; slug: string };

test("an owner edits the organization profile and GitHub receives it", async ({
	page,
}) => {
	await page.goto("/orgs/lumen-labs/settings");
	await page.getByRole("textbox", { name: "Location" }).fill("Berlin");
	await page.getByRole("button", { name: "Save changes" }).click();

	await expect(page.getByText("Saved", { exact: true })).toBeVisible();
	const org = await emulator.rest<Org>("nova", "GET", "/orgs/lumen-labs");
	expect(org.location).toBe("Berlin");
});

test("a member is promoted to owner and a pending invitation is cancelled", async ({
	page,
}) => {
	await page.goto("/orgs/lumen-labs/settings/members");
	await page.getByRole("combobox", { name: "Role for jun-park" }).click();
	await page.getByRole("option", { name: "Owner" }).click();
	await expect(page.getByText("Saved", { exact: true })).toBeVisible();
	const membership = await emulator.rest<Membership>(
		"nova",
		"GET",
		"/orgs/lumen-labs/memberships/jun-park",
	);
	expect(membership.role).toBe("admin");

	await page
		.getByRole("button", {
			name: "Cancel invitation for casey@partner.example",
		})
		.click();
	await page.getByRole("button", { name: "Confirm" }).click();
	await expect(page.getByText("casey@partner.example")).toHaveCount(0);
	const invitations = await emulator.rest<Invitation[]>(
		"nova",
		"GET",
		"/orgs/lumen-labs/invitations",
	);
	expect(invitations).toEqual([]);
});

test("an invitation goes out by email", async ({ page }) => {
	await page.goto("/orgs/lumen-labs/settings/members");
	await page.getByRole("button", { name: "Invite member" }).click();
	await page
		.getByRole("textbox", { name: "Username or email" })
		.fill("dana@partner.example");
	await page.getByRole("button", { name: "Send invitation" }).click();

	await expect(page.getByText("dana@partner.example")).toBeVisible();
	const invitations = await emulator.rest<Invitation[]>(
		"nova",
		"GET",
		"/orgs/lumen-labs/invitations",
	);
	expect(invitations.map((invitation) => invitation.email)).toContain(
		"dana@partner.example",
	);
});

test("a team is created, gains a member, and is deleted", async ({ page }) => {
	await page.goto("/orgs/lumen-labs/settings/teams");
	await page.getByRole("button", { name: "New team" }).click();
	await page.getByRole("textbox", { name: "Name" }).fill("Platform");
	await page.getByRole("button", { name: "Create team" }).click();
	await expect(page.getByText("@lumen-labs/platform")).toBeVisible();

	await page.getByRole("button", { name: "Members of Platform" }).click();
	await page
		.getByRole("textbox", { name: "Add to Platform" })
		.fill("priya-rao");
	await page.getByRole("button", { name: "Add member" }).click();
	await expect(page.getByText("priya-rao")).toBeVisible();
	const members = await emulator.rest<{ login: string }[]>(
		"nova",
		"GET",
		"/orgs/lumen-labs/teams/platform/members",
	);
	expect(members.map((member) => member.login)).toContain("priya-rao");

	await page.getByRole("button", { name: "Delete team Platform" }).click();
	await page.getByRole("button", { name: "Delete", exact: true }).click();
	await expect(page.getByText("@lumen-labs/platform")).toHaveCount(0);
	const teams = await emulator.rest<Team[]>(
		"nova",
		"GET",
		"/orgs/lumen-labs/teams",
	);
	expect(teams.map((team) => team.slug)).not.toContain("platform");
});
