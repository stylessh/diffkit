import { whenInteractive } from "../../support/hydration.ts";
import { expect, test } from "../../support/test.ts";

test.use({ storageState: { cookies: [], origins: [] } });

test("a visitor clicks around the landing preview without leaving the page or reaching the server", async ({
	page,
}) => {
	const serverCalls: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/_serverFn/")) serverCalls.push(request.url());
	});

	await page.goto("/login");
	const preview = page.getByRole("region", {
		name: "Product preview with sample data",
	});
	const nav = preview.getByRole("navigation", { name: "Workspace" });

	await (
		await whenInteractive(nav.getByRole("link", { name: /^Issues/ }))
	).click();
	await expect(
		preview.getByRole("heading", { name: "Issues", level: 1 }),
	).toBeVisible();
	await preview
		.getByRole("link", { name: /^Reconnect drops queued messages/ })
		.click();
	await expect(
		preview.getByRole("heading", { name: "Issues", level: 1 }),
	).toBeVisible();

	await nav.getByRole("link", { name: /^Inbox/ }).click();
	const unread = preview.getByRole("button", { name: /^Unread/ });
	await expect(unread).toHaveText("Unread4");
	await preview
		.getByRole("button", {
			name: /^Support custom headers on the SSE transport/,
		})
		.click();
	await expect(
		preview.getByText("Your review has been requested"),
	).toBeVisible();
	await nav.getByRole("link", { name: /^Inbox/ }).click();
	await expect(unread).toHaveText("Unread3");

	await nav.getByRole("link", { name: /^Pull requests/ }).click();
	await preview
		.getByRole("link", { name: /^Retry webhook deliveries with backoff/ })
		.hover();
	await preview
		.getByRole("link", { name: /^Retry webhook deliveries with backoff/ })
		.click();
	await expect(
		preview.getByText("Park deliveries that exhaust their retries"),
	).toBeVisible();

	await preview.getByRole("button", { name: /^Account, / }).click();
	await expect(page.getByRole("menu")).toHaveCount(0);

	await expect(page).toHaveURL(/\/login/);
	expect(serverCalls).toEqual([]);
});
