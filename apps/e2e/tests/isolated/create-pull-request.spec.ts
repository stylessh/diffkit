import { emulator } from "../../support/emulator.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

test("a branch opened from the list offers the compare form, and the pull request is created with its properties", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/branches?view=all");
	await page
		.getByRole("link", { name: "refactor/on-event", exact: true })
		.click();
	await page.getByRole("link", { name: "Create pull request" }).click();

	await expect(page).toHaveURL(
		/\/lumen-labs\/beacon\/compare\/main\.\.\.refactor\/on-event\?expand=1$/,
	);
	await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue(
		"Rename onMessage to onEvent",
	);

	await page.getByRole("button", { name: "Add labels" }).click();
	await page.getByRole("option", { name: /^bug/ }).click();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Set milestone" }).click();
	await page.getByRole("option", { name: /^v2\.0/ }).click();
	await page.keyboard.press("Escape");
	await page.getByRole("checkbox", { name: "Create as draft" }).click();
	await page.getByRole("button", { name: "Create draft pull request" }).click();

	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/pull\/\d+$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Rename onMessage to onEvent",
		}),
	).toBeVisible();

	const number = new URL(page.url()).pathname.split("/").pop();
	const created = await emulator.rest<{
		draft: boolean;
		head: { ref: string };
		base: { ref: string };
		labels: { name: string }[];
		milestone: { title: string } | null;
	}>("nova", "GET", `/repos/lumen-labs/beacon/pulls/${number}`);
	expect(created).toMatchObject({
		draft: true,
		head: { ref: "refactor/on-event" },
		base: { ref: "main" },
		labels: [{ name: "bug" }],
		milestone: { title: "v2.0" },
	});
});
