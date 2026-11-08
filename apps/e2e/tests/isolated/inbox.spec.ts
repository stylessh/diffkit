import { emulator } from "../../support/emulator.ts";
import { whenInteractive } from "../../support/hydration.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

async function unreadThreadTitles() {
	const threads = await emulator.rest<Array<{ subject: { title: string } }>>(
		"nova",
		"GET",
		"/notifications",
	);
	return threads.map((thread) => thread.subject.title);
}

test("marking a notification as read updates the row and GitHub", async ({
	page,
}) => {
	const mention = "Document on-call escalation";
	expect(await unreadThreadTitles()).toContain(mention);

	await page.goto("/inbox");
	const row = page.getByRole("button", { name: new RegExp(mention) });
	await (await whenInteractive(row)).hover();
	await row.getByRole("button", { name: "Mark as read" }).click();

	await expect(row.getByRole("button", { name: "Mark as read" })).toHaveCount(
		0,
	);
	await expect.poll(unreadThreadTitles).not.toContain(mention);
	expect(await unreadThreadTitles()).toHaveLength(5);
});
