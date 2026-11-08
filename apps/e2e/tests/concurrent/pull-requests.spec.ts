import { whenInteractive } from "../../support/hydration.ts";
import { expect, test } from "../../support/test.ts";

const sseHeaders = /Support custom headers on the SSE transport/;
const buttonLoading = /Add a loading state to Button/;

test("queues filter by author and keep the filter across a reload", async ({
	page,
	context,
}) => {
	await page.goto("/pulls");
	await expect(
		page.getByRole("heading", { level: 2, name: "Review requested" }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: sseHeaders }).first(),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: buttonLoading }).first(),
	).toBeVisible();

	await (
		await whenInteractive(page.getByRole("button", { name: "Filter" }))
	).click();
	await page.getByRole("button", { name: "Author", exact: true }).click();
	await page.getByRole("button", { name: /^theo-martin/ }).click();

	await expect(page.getByRole("link", { name: buttonLoading })).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: sseHeaders }).first(),
	).toBeVisible();

	await expect
		.poll(async () => {
			const cookie = (await context.cookies()).find(
				({ name }) => name === "diffkit-filters",
			);
			return cookie && JSON.parse(decodeURIComponent(cookie.value));
		})
		.toMatchObject({
			pulls: {
				activeFilters: [{ fieldId: "author", values: ["theo-martin"] }],
			},
		});

	await page.reload();
	await expect(
		page.getByRole("link", { name: sseHeaders }).first(),
	).toBeVisible();
	await expect(page.getByRole("link", { name: buttonLoading })).toHaveCount(0);
});

test("a pull request shows its review state and checks, and its diff carries review threads", async ({
	page,
}) => {
	await page.goto("/pulls");
	await page
		.getByRole("link", { name: sseHeaders })
		.first()
		.getByText(sseHeaders)
		.click();

	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/pull\/15$/);
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Support custom headers on the SSE transport",
		}),
	).toBeVisible();
	await expect(page.getByText(/wants to merge into/)).toBeVisible();
	await expect(
		page.getByRole("button", { name: "feat/sse-headers" }),
	).toBeVisible();
	await expect(page.getByText("Your review has been requested")).toBeVisible();
	await expect(
		page.getByRole("button", { name: /1 failing check/ }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: /codecov\/patch — 61\.5% of diff hit/ }),
	).toBeVisible();

	const sidebar = page.getByRole("complementary");
	await expect(sidebar.getByText("enhancement")).toBeVisible();
	await expect(sidebar.getByText("transport")).toBeVisible();
	await expect(sidebar.getByText("nova", { exact: true })).toBeVisible();

	await page.getByRole("link", { name: "Review changes" }).click();
	await expect(page).toHaveURL(/\/lumen-labs\/beacon\/review\/15$/);
	await expect(
		page.getByRole("link", { name: /^sse\.ts \+42 -16/ }),
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: /^README\.md \+2 -1/ }),
	).toBeVisible();
	await expect(
		page.getByText("Spread order means callers can override"),
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Unresolve" })).toBeVisible();
});
