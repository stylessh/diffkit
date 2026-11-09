import { whenInteractive } from "../../support/hydration.ts";
import { expect, test } from "../../support/test.ts";

const sseHeaders = /Support custom headers on the SSE transport/;
const buttonLoading = /Add a loading state to Button/;

test("a list filters from the keyboard, remembers the filter, and searches as you type", async ({
	page,
}) => {
	await page.goto("/pulls");
	await expect(
		page.getByRole("link", { name: buttonLoading }).first(),
	).toBeVisible();

	await whenInteractive(page.getByRole("button", { name: "Filter" }));
	await page.keyboard.press("f");
	await page.getByRole("textbox", { name: "Filter by" }).fill("auth");
	await page.keyboard.press("Enter");
	await page.getByRole("menuitemcheckbox", { name: "theo-martin" }).click();
	await page.keyboard.press("Escape");

	const pill = page.getByRole("group", { name: "Author is theo-martin" });
	await expect(pill).toBeVisible();
	await expect(page).toHaveURL(/filters=author:theo-martin/);
	await expect(page.getByRole("link", { name: buttonLoading })).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: sseHeaders }).first(),
	).toBeVisible();

	await page.goto("/pulls");
	await expect(pill).toBeVisible();
	await expect(page).toHaveURL(/filters=author:theo-martin/);

	await pill.getByRole("button", { name: "Remove Author filter" }).click();
	await expect(pill).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: buttonLoading }).first(),
	).toBeVisible();

	await page.keyboard.press("/");
	await page.keyboard.type("loading state");
	await expect(page.getByRole("link", { name: sseHeaders })).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: buttonLoading }).first().locator("mark"),
	).toHaveText("loading state");

	await page.keyboard.press("Escape");
	await expect(
		page.getByRole("link", { name: sseHeaders }).first(),
	).toBeVisible();
});

test("a pull request shows its review state and checks, and its diff carries review threads", async ({
	page,
}) => {
	await page.goto("/pulls");
	await page
		.getByRole("link", { name: sseHeaders })
		.first()
		.getByText(sseHeaders)
		.click();

	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/pull\/15$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Support custom headers on the SSE transport",
		}),
	).toBeVisible();
	await expect(page.getByText(/wants to merge into/)).toBeVisible();
	await expect(
		page.getByRole("button", { name: "feat/sse-headers" }),
	).toBeVisible();
	await expect(page.getByText("Your review has been requested")).toBeVisible();
	await expect(
		page.getByRole("button", { name: /1 failing check/ }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: /codecov\/patch — 61\.5% of diff hit/ }),
	).toBeVisible();

	// By role: the outgoing skeleton's sample labels are still in the DOM, inert.
	const sidebar = page.getByRole("complementary");
	await expect(
		sidebar.getByRole("button", { name: "enhancement" }),
	).toBeVisible();
	await expect(
		sidebar.getByRole("button", { name: "transport" }),
	).toBeVisible();
	await expect(
		sidebar.getByRole("button", { name: "nova", exact: true }),
	).toBeVisible();

	await page.getByRole("link", { name: "Review changes" }).click();
	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/review\/15$/);
	await expect(page.getByRole("treeitem", { name: "sse.ts" })).toContainText(
		"+42 -16",
	);
	await expect(page.getByRole("treeitem", { name: "README.md" })).toContainText(
		"+2 -1",
	);
	await expect(
		page.getByText("Spread order means callers can override"),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Unresolve" })).toBeVisible();
});
