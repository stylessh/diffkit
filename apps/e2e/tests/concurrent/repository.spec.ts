import { expect, test } from "../../support/test.ts";

test("the repository tabs, and the pages tucked behind them, show history, branches with their pull requests, and releases", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/commits");

	await expect(
		page.getByRole("heading", { level: 1, name: "Commits" }),
	).toBeVisible();
	const latest = page.getByRole("link", {
		name: "Enable noUncheckedIndexedAccess",
	});
	await expect(latest).toHaveAttribute(
		"href",
		/\/lumen-labs\/beacon\/commit\/fcb11cb/,
	);
	await expect(
		page.getByRole("heading", {
			level: 2,
			name: "Commits in October 2026",
		}),
	).toBeVisible();

	const repositoryTabs = page.getByRole("navigation", { name: "Repository" });
	const morePages = repositoryTabs.getByRole("button", {
		name: "More repository pages",
	});
	await morePages.click();
	await page.getByRole("menuitem", { name: /^Branches/ }).click();
	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/branches$/);
	await expect(
		page.getByRole("heading", { level: 1, name: "Branches" }),
	).toBeVisible();
	await expect(
		repositoryTabs.getByRole("link", { name: "Branches 10" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "feat/webtransport", exact: true }),
	).toBeVisible();
	await expect(
		page.getByRole("img", { name: "0 behind, 3 ahead of main" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "#20", exact: true }),
	).toHaveAttribute("href", "/lumen-labs/beacon/pull/20");

	await morePages.click();
	await page.getByRole("menuitem", { name: "Releases" }).click();
	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/releases$/);
	const draft = page.getByRole("article", { name: "v1.4.0", exact: true });
	await expect(draft.getByText("Draft", { exact: true })).toBeVisible();
	await expect(draft.getByText("Jittered backoff")).toBeVisible();
	await expect(
		page
			.getByRole("article", { name: "v1.4.0-beta.1" })
			.getByText("Pre-release"),
	).toBeVisible();
});

test("the map lives under the repository tabs: new and leading to the setup prompt where there is none, and the map itself where there is", async ({
	page,
}) => {
	await page.goto("/lumen-labs/orbit");
	const repositoryTabs = page.getByRole("navigation", { name: "Repository" });

	await repositoryTabs.getByRole("link", { name: "Map New" }).click();
	await expect(page).toHaveURL(/\/lumen-labs\/orbit\/map$/);
	await expect(
		page.getByRole("heading", { level: 1, name: "Give orbit a product map" }),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Prompt for a coding agent" }),
	).toContainText("lumen-labs/orbit");
	await expect(
		repositoryTabs.getByRole("link", { name: "Map New" }),
	).toHaveAttribute("aria-current", "page");

	await repositoryTabs.getByRole("link", { name: "Code" }).click();
	await expect(page).toHaveURL(/\/lumen-labs\/orbit$/);

	await page.goto("/lumen-labs/beacon");
	await repositoryTabs.getByRole("link", { name: "Map", exact: true }).click();
	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/map$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "beacon is a typed event client for the browser.",
		}),
	).toBeVisible();
	await expect(
		repositoryTabs.getByRole("link", { name: "Map", exact: true }),
	).toHaveAttribute("aria-current", "page");

	await page.getByRole("button", { name: "Event client" }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Event client" }),
	).toBeVisible();
	await expect(
		repositoryTabs.getByRole("link", { name: "Pull requests 7" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Section: How it works" }).click();
	await page.getByRole("menuitemradio", { name: "Activity 2" }).click();
	await expect(
		page.getByRole("button", { name: "Section: Activity" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Product map" }).click();
	await expect(
		page.getByRole("button", { name: "Map view: Structure" }),
	).toBeVisible();
});
