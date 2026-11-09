import { whenInteractive } from "../../support/hydration.ts";
import { expect, test } from "../../support/test.ts";

test("the topbar creates an issue in a picked repository and lists pinned repositories first in the repository picker", async ({
	page,
}) => {
	await page.goto("/pulls");
	const workspace = page.getByRole("navigation", { name: "Workspace" });
	await expect(
		workspace.getByRole("link", { name: /^Pull requests/ }),
	).toHaveAttribute("aria-current", "page");

	await (
		await whenInteractive(page.getByRole("button", { name: "Create" }))
	).click();
	await page.getByRole("menuitem", { name: "New issue…" }).click();
	await page.getByRole("combobox").fill("dotfiles");
	await page.getByRole("option", { name: "nova/dotfiles" }).click();

	await expect(page).toHaveURL(/\/nova\/dotfiles\/issues\/new$/);
	await expect(
		page.getByRole("heading", { level: 1, name: "Create new issue" }),
	).toBeVisible();

	await page.getByRole("button", { name: "Search" }).click();
	await page.getByRole("combobox").fill("pin");
	await page.getByRole("option", { name: "Pin nova/dotfiles" }).click();

	await page.goto("/issues");
	await whenInteractive(
		page
			.getByRole("navigation", { name: "Workspace" })
			.getByRole("link", { name: /^Issues/ }),
	);
	await page.keyboard.press("o");
	await page.keyboard.press("r");
	const picker = page.getByRole("dialog", { name: "Switch repository" });
	await expect(picker.getByText("Pinned", { exact: true })).toBeVisible();
	await picker.getByRole("option", { name: "nova/dotfiles" }).click();
	await expect(page).toHaveURL(/\/nova\/dotfiles$/);
});
