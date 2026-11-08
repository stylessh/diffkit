import { emulator } from "../../support/emulator.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

test("a new issue is created in the repository and shows up in nova's authored queue", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/issues/new");
	await page
		.getByRole("textbox", { name: "Title *" })
		.fill("Reconnect jitter ignores maxDelay");
	await page
		.getByRole("textbox", { name: "Describe the issue..." })
		.fill("With jitter on, the delay can exceed maxDelay by up to 20%.");
	await page.getByRole("button", { name: "Create issue" }).click();

	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/issues\/(?!new)\d+$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Reconnect jitter ignores maxDelay",
		}),
	).toBeVisible();
	await expect(
		page.getByText(
			"With jitter on, the delay can exceed maxDelay by up to 20%.",
		),
	).toBeVisible();

	const number = new URL(page.url()).pathname.split("/").pop();
	const created = await emulator.rest<{
		title: string;
		state: string;
		user: { login: string };
	}>("nova", "GET", `/repos/lumen-labs/beacon/issues/${number}`);
	expect(created).toMatchObject({
		title: "Reconnect jitter ignores maxDelay",
		state: "open",
		user: { login: "nova" },
	});

	await page
		.getByRole("navigation", { name: "Workspace" })
		.getByRole("link", { name: /^Issues \d+$/ })
		.click();
	await expect(
		page.getByRole("link", {
			name: new RegExp(
				`Reconnect jitter ignores maxDelay lumen-labs/beacon #${number} · nova`,
			),
		}),
	).toBeVisible();
});
