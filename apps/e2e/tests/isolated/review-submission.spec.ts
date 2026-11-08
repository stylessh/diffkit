import { emulator } from "../../support/emulator.ts";
import { whenInteractive } from "../../support/hydration.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

test("approving from the review page records the review and unblocks the pull request", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/review/15");
	const open = page.getByRole("button", { name: "Submit review" });
	await (await whenInteractive(open)).click();

	const dialog = page.getByRole("dialog");
	await dialog
		.getByRole("textbox", { name: "Review summary" })
		.fill("Headers look right, shipping it.");
	await dialog.getByText("Approve", { exact: true }).click();
	await expect(dialog.getByRole("radio", { name: /^Approve/ })).toBeChecked();
	await dialog.getByRole("button", { name: "Submit review" }).click();

	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/pull\/15$/);
	await expect(
		page.getByRole("button", { name: /Changes approved/ }),
	).toBeVisible();

	const reviews = await emulator.rest<
		Array<{ state: string; body: string; user: { login: string } }>
	>("nova", "GET", "/repos/lumen-labs/beacon/pulls/15/reviews");
	expect(reviews).toContainEqual(
		expect.objectContaining({
			state: "APPROVED",
			body: "Headers look right, shipping it.",
			user: expect.objectContaining({ login: "nova" }),
		}),
	);
});
