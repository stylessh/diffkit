import { expect, type Locator } from "@playwright/test";

/** Server-rendered controls ignore input until React attaches its handlers. */
export async function whenInteractive(control: Locator) {
	await expect
		.poll(() =>
			control.evaluate((element) =>
				Object.keys(element).some((key) => key.startsWith("__reactProps$")),
			),
		)
		.toBe(true);
	return control;
}
