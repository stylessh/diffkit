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
