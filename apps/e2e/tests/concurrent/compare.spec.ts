import { expect, test } from "../../support/test.ts";

test("the compare page opens on a recent branch and accepts an owner-qualified head", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/compare");

	await expect(
		page.getByRole("heading", { name: "Choose a branch to compare with main" }),
	).toBeVisible();
	await page.getByRole("link", { name: "feat/webtransport" }).click();

	await expect(page).toHaveURL(
		/\/lumen-labs\/beacon\/compare\/main\.\.\.feat\/webtransport$/,
	);
	await expect(page.getByText("3 commits ahead")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Compare branch: feat/webtransport" }),
	).toBeVisible();

	await page
		.getByRole("button", { name: "Compare branch: feat/webtransport" })
		.click();
	await page
		.getByPlaceholder("Find a branch or type owner:branch…")
		.fill("lumen-labs:feat/sse-headers");
	await page
		.getByRole("option", { name: /lumen-labs:feat\/sse-headers/ })
		.click();

	await expect(page).toHaveURL(
		/\/lumen-labs\/beacon\/compare\/main\.\.\.lumen-labs(:|%3A)feat\/sse-headers$/,
	);
	await expect(
		page.getByRole("button", {
			name: "Compare branch: lumen-labs:feat/sse-headers",
		}),
	).toBeVisible();
	await expect(page.getByText(/commits? ahead/)).toBeVisible();
});

const routeLoad = { timeout: 15_000 };

test("the header links the pull request open for this base and head, and offers one otherwise", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/compare/main...feat/jitter-backoff");
	await expect(
		page.getByRole("link", { name: "View pull request #14" }),
	).toBeVisible(routeLoad);

	await page.goto("/lumen-labs/beacon/compare/main...feat/webtransport");
	await expect(
		page.getByRole("link", { name: "Create pull request" }),
	).toBeVisible(routeLoad);
	await expect(
		page.getByRole("link", { name: /View pull request/ }),
	).toHaveCount(0);
});
