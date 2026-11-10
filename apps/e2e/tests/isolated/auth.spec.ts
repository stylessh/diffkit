import { emulatorUrl } from "../../support/endpoints.ts";
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

	const account = page.getByRole("button", { name: /^Account, / });
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

test("a failed GitHub sign-in returns to the landing page with a message, and retrying keeps the redirect", async ({
	page,
}) => {
	await page.route(`${emulatorUrl}/login/oauth/authorize?**`, (route) => {
		const authorize = new URL(route.request().url());
		const callback = new URL(authorize.searchParams.get("redirect_uri") ?? "");
		callback.searchParams.set("code", "expired-code");
		callback.searchParams.set(
			"state",
			authorize.searchParams.get("state") ?? "",
		);
		return route.fulfill({ status: 302, headers: { location: callback.href } });
	});

	await page.goto("/pulls");
	const continueButton = page.getByRole("button", {
		name: "Continue with GitHub",
	});
	await (await whenInteractive(continueButton)).click();

	await expect(page).toHaveURL(/\/login\?redirect=%2Fpulls&error=/);
	await expect(page.getByRole("alert")).toHaveText(
		"GitHub sign-in didn’t go through. Please try again.",
	);

	await page.unrouteAll();
	await (await whenInteractive(continueButton)).click();
	await page.getByRole("button", { name: /nova\b/ }).click();
	await page.getByRole("button", { name: "Got it" }).click();
	await expect(page).toHaveURL(/\/pulls$/);
});
