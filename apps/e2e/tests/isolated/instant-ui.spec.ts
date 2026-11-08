import type { Page } from "@playwright/test";
import { expect, isolatedTest as test } from "../../support/test.ts";

const description = (page: Page) =>
	page.getByText("Chrome-only prototype, not ready for review.");

type RouterHandle = {
	preloadRoute(options: {
		to: string;
		params: Record<string, string>;
	}): Promise<unknown>;
};

function persistedQueriesMention(page: Page, text: string) {
	return page.evaluate(async (needle) => {
		const databases = await indexedDB.databases();
		for (const { name } of databases) {
			if (!name?.startsWith("diffkit-query-cache:")) {
				continue;
			}
			const database = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open(name);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const records = await new Promise<unknown[]>((resolve, reject) => {
				const request = database
					.transaction("queries")
					.objectStore("queries")
					.getAll();
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			database.close();
			if (JSON.stringify(records).includes(needle)) {
				return true;
			}
		}
		return false;
	}, text);
}

test("a pull request seen before paints from IndexedDB without a skeleton while the server is silent", async ({
	page,
}) => {
	await page.addInitScript(() => {
		const win = window as unknown as { skeletonShown: boolean };
		win.skeletonShown = false;
		// `.pending-reveal` is the router's pending component (see styles.css).
		new MutationObserver(() => {
			if (document.querySelector(".pending-reveal")) {
				win.skeletonShown = true;
			}
		}).observe(document, { childList: true, subtree: true });
	});

	await page.goto("/lumen-labs/beacon/pull/20");
	await expect(description(page)).toBeVisible();
	await expect
		.poll(() => persistedQueriesMention(page, "Chrome-only prototype"))
		.toBe(true);

	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Welcome back, Nova" }),
	).toBeVisible();

	const serverSilent = Promise.withResolvers<void>();
	await page.route("**/_serverFn/**", async (route) => {
		await serverSilent.promise;
		await route.continue().catch(() => undefined);
	});

	// `vite dev` serves a route as ~100 separate modules; load them first so the
	// 300 ms below measures the cache paint, not the dev server.
	await page.evaluate(() =>
		(
			window as unknown as { __TSR_ROUTER__: RouterHandle }
		).__TSR_ROUTER__.preloadRoute({
			to: "/$owner/$repo/pull/$pullId",
			params: { owner: "lumen-labs", repo: "beacon", pullId: "20" },
		}),
	);

	await page.evaluate(() => {
		(window as unknown as { skeletonShown: boolean }).skeletonShown = false;
	});
	await page
		.getByRole("link", { name: /lumen-labs\/beacon #20 · nova/ })
		.getByText("Stack 3/3: Experimental WebTransport transport")
		.click();
	await expect(description(page)).toBeVisible({ timeout: 300 });
	expect(
		await page.evaluate(
			() => (window as unknown as { skeletonShown: boolean }).skeletonShown,
		),
	).toBe(false);

	serverSilent.resolve();
});
