import { expect, type Page } from "@playwright/test";
import { emulatorUrl } from "./endpoints.ts";
import { whenInteractive } from "./hydration.ts";

export async function signInAs(page: Page, login: string, timeout = 5_000) {
	await page.goto("/login");
	const continueButton = page.getByRole("button", {
		name: "Continue with GitHub",
	});
	await (await whenInteractive(continueButton, timeout)).click();
	await expect(page).toHaveURL(new RegExp(`^${emulatorUrl}/login/oauth/`));
	await page.getByRole("button", { name: new RegExp(`${login}\\b`) }).click();
	await page.getByRole("button", { name: "Got it" }).click();
	await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible(
		{ timeout },
	);
}
