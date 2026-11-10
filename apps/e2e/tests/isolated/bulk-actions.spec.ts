import { emulator } from "../../support/emulator.ts";
import { whenInteractive } from "../../support/hydration.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

const sseHeaders = "Support custom headers on the SSE transport";
const buttonLoading = "Add a loading state to Button";
const draftStack = "Stack 3/3: Experimental WebTransport transport";

test("a range of selected pull requests merges together and leaves the draft out", async ({
	page,
}) => {
	await page.goto("/pulls");
	const select = (title: string) =>
		page.getByRole("checkbox", { name: new RegExp(`Select #\\d+ ${title}`) });
	const bar = page.getByRole("toolbar", {
		name: "Actions for the selected pull requests",
	});

	await (await whenInteractive(select(sseHeaders).first())).click();
	await select(draftStack)
		.first()
		.click({ modifiers: ["Shift"] });
	await expect(bar.getByText("3 selected")).toBeVisible();
	await expect(select(buttonLoading).first()).toBeChecked();

	await bar.getByRole("button", { name: "Merge 2" }).click();
	const review = page.getByRole("dialog", { name: "Merge 2 pull requests?" });
	await expect(
		review.getByRole("listitem").filter({ hasText: "Draft" }),
	).toContainText(draftStack);
	await review.getByRole("button", { name: "Merge 2 pull requests" }).click();

	await expect(page.getByText("Merged 2 pull requests")).toBeVisible();
	await expect(select(sseHeaders)).toHaveCount(0);
	await expect(select(buttonLoading)).toHaveCount(0);
	await expect(bar.getByText("1 selected")).toBeVisible();
	await expect(select(draftStack).first()).toBeChecked();

	const [beacon, orbit] = await Promise.all([
		emulator.rest<{ merged: boolean }>(
			"nova",
			"GET",
			"/repos/lumen-labs/beacon/pulls/15",
		),
		emulator.rest<{ merged: boolean }>(
			"nova",
			"GET",
			"/repos/lumen-labs/orbit/pulls/7",
		),
	]);
	expect([beacon.merged, orbit.merged]).toEqual([true, true]);

	await page.keyboard.press("Escape");
	await expect(bar).toHaveCount(0);
});

test("selected issues close with a reason, and a failed one stays selected to retry", async ({
	page,
}) => {
	await page.goto("/lumen-labs/orbit/issues");
	const select = (number: number) =>
		page.getByRole("checkbox", { name: new RegExp(`Select #${number} `) });
	const bar = page.getByRole("toolbar", {
		name: "Actions for the selected issues",
	});

	await whenInteractive(select(4));
	await select(4).hover();
	await page.keyboard.press("x");
	await select(1).click({ modifiers: ["Shift"] });
	await expect(bar.getByText("3 selected")).toBeVisible();

	let writes = 0;
	await page.route(/_serverFn/, (route) => {
		if (route.request().method() !== "POST") return route.continue();
		writes += 1;
		return writes === 2 ? route.abort() : route.continue();
	});

	await bar.getByRole("button", { name: "Close" }).click();
	const confirm = page.getByRole("dialog", { name: "Close 3 issues?" });
	await confirm.getByRole("combobox", { name: "Close as" }).click();
	await page.getByRole("option", { name: "Not planned" }).click();
	await confirm.getByRole("button", { name: "Close 3 issues" }).click();

	const settled = page.getByRole("dialog", { name: "Closed 2 of 3 issues" });
	await expect(settled.getByText("Something went wrong")).toBeVisible();
	await expect(select(3)).toBeChecked();
	await expect(select(4)).toHaveCount(0);

	await page.unroute(/_serverFn/);
	await settled.getByRole("button", { name: "Retry 1 issue" }).click();
	await expect(page.getByText("Closed 1 issue", { exact: true })).toBeVisible();
	await expect(bar).toHaveCount(0);
	await expect(
		page.getByRole("checkbox", { name: /Select #\d+ / }),
	).toHaveCount(1);
	await expect(select(5)).not.toBeChecked();

	const closed = await emulator.rest<{ state: string; state_reason: string }>(
		"nova",
		"GET",
		"/repos/lumen-labs/orbit/issues/3",
	);
	expect(closed).toMatchObject({
		state: "closed",
		state_reason: "not_planned",
	});
});
