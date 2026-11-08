import { whenInteractive } from "../../support/hydration.ts";
import { signInAs } from "../../support/sign-in.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

test.use({ storageState: { cookies: [], origins: [] } });

test("signing in through GitHub lands on the dashboard and signing out locks it again", async ({
	page,
}) => {
	await page.goto("/pulls");
	await expect(page).toHaveURL(/\/login\?redirect=%2Fpulls$/);

	await signInAs(page, "nova");
	await expect(
		page
			.getByRole("navigation", { name: "Workspace" })
			.getByRole("link", { name: /^Pull requests/ }),
	).toBeVisible();

	const account = page.getByRole("button", { name: /^(NR|Nova Reyes)$/ });
	await (await whenInteractive(account)).click();
	await expect(page.getByRole("menu")).toContainText("@nova");
	await page.getByRole("menuitem", { name: "Sign out" }).click();

	await expect(page).toHaveURL(/\/login/);
	await page.goto("/pulls");
	await expect(page).toHaveURL(/\/login\?redirect=%2Fpulls$/);
	await expect(
		page.getByRole("button", { name: "Continue with GitHub" }),
	).toBeVisible();
});
