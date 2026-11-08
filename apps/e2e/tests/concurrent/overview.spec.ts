import { expect, test } from "../../support/test.ts";

test("home summarises nova's queues and links into them", async ({ page }) => {
	await page.goto("/");

	await expect(
		page.getByRole("heading", { name: "Welcome back, Nova" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "3 Open Pull Requests" }),
	).toHaveAttribute("href", "/pulls");
	await expect(
		page.getByRole("link", { name: "5 Open Issues" }),
	).toHaveAttribute("href", "/issues");
	await expect(
		page.getByRole("link", { name: "2 Review Requests" }),
	).toHaveAttribute("href", "/reviews");

	const recent = page.getByRole("link", { name: /Stack 3\/3: Experimental/ });
	await expect(recent).toHaveAttribute("href", "/lumen-labs/beacon/pull/20");
	await recent
		.getByText("Stack 3/3: Experimental WebTransport transport")
		.click();
	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/pull\/20$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Stack 3/3: Experimental WebTransport transport",
		}),
	).toBeVisible();
});
