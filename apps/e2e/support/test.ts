import { test as base } from "@playwright/test";
import { emulator } from "./emulator.ts";

export const expect = base.expect;

export const test = base;

export const isolatedTest = base.extend<{ freshEmulator: undefined }>({
	freshEmulator: [
		// biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern as the first fixture argument
		async ({}, use) => {
			await emulator.reset();
			await use(undefined);
		},
		{ auto: true },
	],
});
