import { emulator } from "../../support/emulator.ts";
import { whenInteractive } from "../../support/hydration.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

async function allThreadTitles() {
	const threads = await emulator.rest<Array<{ subject: { title: string } }>>(
		"nova",
		"GET",
		"/notifications?all=true",
	);
	return threads.map((thread) => thread.subject.title);
}

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

test("triaging from the keyboard marks the thread done and moves to the next one", async ({
	page,
}) => {
	await page.goto("/inbox");
	await whenInteractive(
		page.getByRole("button", { name: /Document on-call escalation/ }),
	);

	await page.keyboard.press("j");
	const first = page.locator("[aria-current=true]");
	const title = (await first.locator("p").innerText()).trim();
	await page.keyboard.press("e");

	await expect(page.getByRole("button", { name: title })).toHaveCount(0);
	await expect(page.locator("[aria-current=true] p")).not.toHaveText(title);
	await expect.poll(allThreadTitles).not.toContain(title);
});
