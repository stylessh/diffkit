import { whenInteractive } from "../../support/hydration.ts";
import { expect, test } from "../../support/test.ts";

test("creating an issue from a list asks for the repository, and a pinned repository stays in the sidebar", async ({
	page,
}) => {
	await page.goto("/pulls");
	const workspace = page.getByRole("navigation", { name: "Workspace" });

	await (
		await whenInteractive(workspace.getByRole("button", { name: "Create" }))
	).click();
	await page.getByRole("menuitem", { name: "New issue…" }).click();
	await page.getByRole("combobox").fill("dotfiles");
	await page.getByRole("option", { name: "nova/dotfiles" }).click();

	await expect(page).toHaveURL(/\/nova\/dotfiles\/issues\/new$/);
	await expect(
		page.getByRole("heading", { level: 1, name: "Create new issue" }),
	).toBeVisible();

	const repositories = workspace.getByRole("region", { name: "Repositories" });
	await repositories.getByRole("button", { name: "Pin a repository" }).click();
	await page.getByRole("option", { name: "nova/dotfiles" }).click();
	await expect(
		repositories.getByRole("link", { name: "nova/dotfiles" }),
	).toBeVisible();

	await page.reload();
	await expect(
		repositories.getByRole("link", { name: "nova/dotfiles" }),
	).toBeVisible();
});
