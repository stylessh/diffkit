import { signInAs } from "../../support/sign-in.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

test.use({ storageState: { cookies: [], origins: [] } });

test("someone who cannot push is never shown the map setup, but can open a map that exists", async ({
	page,
}) => {
	await signInAs(page, "mika-tanaka");
	const repositoryTabs = page.getByRole("navigation", { name: "Repository" });

	await page.goto("/lumen-labs/orbit/map");
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "orbit has no product map yet",
		}),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Prompt for a coding agent" }),
	).toHaveCount(0);

	await repositoryTabs.getByRole("link", { name: "Code" }).click();
	await expect(
		repositoryTabs.getByRole("link", { name: "Issues 4" }),
	).toBeVisible();
	await expect(repositoryTabs.getByRole("link", { name: /^Map/ })).toHaveCount(
		0,
	);

	await page.goto("/lumen-labs/beacon");
	await repositoryTabs.getByRole("link", { name: "Map", exact: true }).click();
	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/map$/);
	await expect(
		page.getByRole("button", { name: "Map view: Structure" }),
	).toBeVisible();
});
