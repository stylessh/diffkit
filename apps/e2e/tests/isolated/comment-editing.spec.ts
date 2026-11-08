import type { Page } from "@playwright/test";
import { emulator } from "../../support/emulator.ts";
import { whenInteractive } from "../../support/hydration.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

type Comment = { id: number; body: string };

const issueComments = () =>
	emulator.rest<Comment[]>(
		"nova",
		"GET",
		"/repos/lumen-labs/beacon/issues/13/comments",
	);

function commentCard(page: Page, text: string) {
	return page
		.locator("div")
		.filter({ has: page.getByText(text) })
		.filter({ has: page.getByRole("button", { name: "Comment actions" }) })
		.last();
}

async function openCommentMenu(page: Page, text: string) {
	const card = commentCard(page, text);
	await card.hover();
	await (
		await whenInteractive(card.getByRole("button", { name: "Comment actions" }))
	).click();
}

test("nova edits and then deletes their own comment", async ({ page }) => {
	await page.goto("/lumen-labs/beacon/issues/13");

	await openCommentMenu(page, "Good catch.");
	await page.getByRole("menuitem", { name: "Edit" }).click();
	const editor = page.getByPlaceholder("Leave a comment...").first();
	await expect(editor).toHaveValue(/Good catch\./);
	await editor.fill("Fixed in #15: close() now clears the listener map.");
	await page.getByRole("button", { name: "Save" }).click();

	const edited = commentCard(page, "Fixed in #15");
	await expect(edited.getByText("edited")).toBeVisible();
	await expect(edited.getByRole("link", { name: "#15" })).toBeVisible();
	await expect
		.poll(async () => (await issueComments()).map((comment) => comment.body))
		.toContain("Fixed in #15: close() now clears the listener map.");

	await openCommentMenu(page, "Fixed in #15");
	await page.getByRole("menuitem", { name: "Delete" }).click();
	await page.getByRole("button", { name: "Delete comment" }).click();

	await expect(page.getByText("Fixed in #15")).toHaveCount(0);
	await expect
		.poll(async () => (await issueComments()).map((comment) => comment.body))
		.not.toContain("Fixed in #15: close() now clears the listener map.");
});
