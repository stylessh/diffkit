import { chromium } from "@playwright/test";
import { emulator } from "./emulator.ts";
import { dashboardUrl, novaAuthFile } from "./endpoints.ts";
import { signInAs } from "./sign-in.ts";

const routesToCompile = [
	"/pulls",
	"/issues",
	"/inbox",
	"/lumen-labs/beacon/pull/15",
	"/lumen-labs/beacon/review/15",
	"/lumen-labs/beacon/issues/13",
	"/lumen-labs/beacon/issues/new",
	"/lumen-labs/beacon/commits",
	"/lumen-labs/beacon/branches",
	"/lumen-labs/beacon/releases",
	"/lumen-labs/beacon/tree/main/src",
	"/lumen-labs/beacon/blob/main/src/client.ts",
	"/lumen-labs/beacon/blame/main/src/client.ts",
	"/lumen-labs/beacon/search?q=reconnect",
	"/lumen-labs/beacon/compare",
	"/lumen-labs/beacon/compare/main...refactor/on-event?expand=1",
];

/**
 * The first request compiles /login and the dashboard home on a cold
 * `vite dev`, which on CI outgrows the 5 s hydration wait specs use.
 */
const COLD_START_BUDGET_MS = 60_000;

export default async function globalSetup() {
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({ baseURL: dashboardUrl });
		const page = await context.newPage();
		await signInAs(page, "nova", COLD_START_BUDGET_MS);
		await context.storageState({ path: novaAuthFile });

		// The dev server compiles routes and optimizes dependencies on first
		// use, and reloads the page when it discovers new ones mid-test.
		for (const route of routesToCompile) {
			await page.goto(route, { waitUntil: "networkidle" });
		}
	} finally {
		await browser.close();
	}
	await emulator.checkpoint();
}
