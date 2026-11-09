import { expect, test } from "../../support/test.ts";

test("home summarises nova's queues and links into them", async ({ page }) => {
	await page.goto("/");

	await expect(
		page.getByRole("heading", { name: "Welcome back, Nova" }),
	).toBeVisible();
	const summary = page.getByRole("paragraph").filter({ hasText: "You have" });
	await expect(
		summary.getByRole("link", { name: "2 pull requests" }),
	).toHaveAttribute("href", "/reviews");
	await expect(
		summary.getByRole("link", { name: "2 open pull requests" }),
	).toHaveAttribute("href", /^\/pulls\?filters=status(:|%3A)open$/);
	await expect(summary.getByRole("link", { name: "1 draft" })).toHaveAttribute(
		"href",
		/^\/pulls\?filters=status(:|%3A)draft$/,
	);
	await expect(summary.getByRole("link", { name: "5 issues" })).toHaveAttribute(
		"href",
		"/issues",
	);

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
