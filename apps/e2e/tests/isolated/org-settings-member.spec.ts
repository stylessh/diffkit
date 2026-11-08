import { signInAs } from "../../support/sign-in.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

test.use({ storageState: { cookies: [], origins: [] } });

test("a member sees the roster but none of the owner controls", async ({
	page,
}) => {
	await signInAs(page, "lena-fischer");
	await page.goto("/orgs/lumen-labs/settings/members");

	await expect(page.getByText("jun-park", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Invite member" })).toHaveCount(
		0,
	);
	await expect(page.getByRole("combobox")).toHaveCount(0);
	await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);

	await page.goto("/orgs/lumen-labs/settings");
	await expect(
		page.getByRole("textbox", { name: "Display name" }),
	).toBeDisabled();
});
