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
];

export default async function globalSetup() {
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({ baseURL: dashboardUrl });
		const page = await context.newPage();
		await signInAs(page, "nova");
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
