import { expect, type Locator } from "@playwright/test";

/** Server-rendered controls ignore input until React attaches its handlers. */
export async function whenInteractive(control: Locator, timeout = 5_000) {
	await expect
		.poll(
			() =>
				control.evaluate((element) =>
					Object.keys(element).some((key) => key.startsWith("__reactProps$")),
				),
			{ timeout },
		)
		.toBe(true);
	return control;
}
