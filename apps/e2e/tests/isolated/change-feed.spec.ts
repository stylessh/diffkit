import { emulator, postWebhook } from "../../support/emulator.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

const issue13Row = (page: import("@playwright/test").Page, comments: number) =>
	page.getByRole("link", {
		name: new RegExp(
			`Listeners are never released after close\\(\\).*, ${comments} comments$`,
		),
	});

test("a signed webhook refreshes the affected list without a reload", async ({
	page,
}) => {
	const feedCursorEstablished = page.waitForResponse((response) =>
		response.url().includes("/api/changes"),
	);
	await page.goto("/issues");
	await expect(issue13Row(page, 2)).toBeVisible();
	await feedCursorEstablished;
	await page.evaluate(() => {
		(window as unknown as { sameDocument: boolean }).sameDocument = true;
	});

	await emulator.rest(
		"jun-park",
		"POST",
		"/repos/lumen-labs/beacon/issues/13/comments",
		{
			body: "Reproduced on 2.0.0-rc.1.",
		},
	);
	const payload = {
		action: "created",
		issue: { number: 13 },
		repository: await emulator.rest("nova", "GET", "/repos/lumen-labs/beacon"),
	};

	const forged = await postWebhook("issue_comment", payload, {
		secret: "wrong",
	});
	// The app answers 401; Miniflare's dev proxy surfaces that response as a 500.
	expect(forged.ok).toBe(false);
	const delivered = await postWebhook("issue_comment", payload);
	expect(delivered.status).toBe(202);

	// The feed polls every 15 s and on focus; focus keeps the test off the interval.
	const refreshesTo = (comments: number) =>
		expect(async () => {
			await page.evaluate(() => window.dispatchEvent(new Event("focus")));
			await expect(issue13Row(page, comments)).toBeVisible({ timeout: 1000 });
		}).toPass({ timeout: 30_000 });
	await refreshesTo(3);

	// A second change to the same issue updates its feed row, which must still
	// reach a client that already saw the first.
	await emulator.rest(
		"jun-park",
		"POST",
		"/repos/lumen-labs/beacon/issues/13/comments",
		{ body: "Also on 2.0.0-rc.2." },
	);
	expect((await postWebhook("issue_comment", payload)).status).toBe(202);
	await refreshesTo(4);

	expect(
		await page.evaluate(
			() => (window as unknown as { sameDocument?: boolean }).sameDocument,
		),
	).toBe(true);
});
