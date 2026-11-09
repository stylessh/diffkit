import { expect, test } from "../../support/test.ts";

test("an issue opens from nova's queue with its labels, assignee, milestone and discussion", async ({
	page,
}) => {
	await page.goto("/issues");
	await expect(
		page.getByRole("heading", { level: 2, name: "Assigned" }),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "Authored" }),
	).toBeVisible();

	await page
		.getByRole("link", { name: /Listeners are never released after close\(\)/ })
		.click();

	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/issues\/13$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Listeners are never released after close()",
		}),
	).toBeVisible();
	await expect(
		page.getByText("Good catch. I'll clear the map in"),
	).toBeVisible();
	await expect(
		page.getByText("Hit this in Orbit's docs site too"),
	).toBeVisible();

	const sidebar = page.getByRole("complementary");
	await expect(
		sidebar.getByRole("button", { name: "bug", exact: true }),
	).toBeVisible();
	await expect(
		sidebar.getByRole("button", { name: "priority: high" }),
	).toBeVisible();
	await expect(sidebar.getByText("v1.4")).toBeVisible();
	await expect(sidebar.getByText("nova", { exact: true })).toBeVisible();
});
