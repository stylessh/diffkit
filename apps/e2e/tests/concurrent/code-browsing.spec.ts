import { expect, test } from "../../support/test.ts";

test("browse a folder, open a file by finder, link lines, blame them and search the code", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/tree/main/src");

	const path = page.getByRole("navigation", { name: "Path" });
	await expect(path.getByText("src", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("link", { name: "client.ts" }).first(),
	).toBeVisible();

	await page.keyboard.press("t");
	await page.getByPlaceholder("Go to file in beacon…").fill("sse");
	await expect(page.getByRole("option").first()).toContainText("sse.ts");
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(/\/blob\/main\/src\/transport\/sse\.ts$/);
	await expect(
		page.getByText("ServerSentEventsTransport").first(),
	).toBeVisible();

	await page.locator("#L3").click();
	await page.locator("#L6").click({ modifiers: ["Shift"] });
	await expect(page).toHaveURL(/#L3-L6$/);

	await page
		.getByRole("navigation", { name: "File view" })
		.getByRole("link", { name: "Blame" })
		.click();
	await expect(page).toHaveURL(/\/blame\/main\/src\/transport\/sse\.ts$/);
	const blameEntry = page.getByRole("link", {
		name: /Add SSE transport and reconnect with backoff/,
	});
	await blameEntry.first().focus();
	await page.getByRole("link", { name: "View file at this commit" }).click();
	await expect(page).toHaveURL(
		/\/blob\/[0-9a-f]{40}\/src\/transport\/sse\.ts$/,
	);

	await page.goto("/lumen-labs/beacon/search?q=reconnect");
	const results = page.getByRole("region", { name: /^Code/ });
	await expect(results).toContainText("4 files");
	await expect(
		results.getByRole("link", { name: "src/client.ts" }),
	).toHaveAttribute("href", "/lumen-labs/beacon/blob/main/src/client.ts");
	await expect(results.locator("mark").first()).toHaveText(/reconnect/i);
});
