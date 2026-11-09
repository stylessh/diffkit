import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	COLOR_THEME_BOOT_SCRIPT,
	COLOR_THEMES,
	DEFAULT_COLOR_THEME,
} from "./color-themes";

const globalsCss = readFileSync(
	fileURLToPath(
		new URL("../../../../packages/ui/src/styles/globals.css", import.meta.url),
	),
	"utf8",
);

function runBootScript(saved: Record<string, string>) {
	const attributes = new Map<string, string>();
	const context = {
		localStorage: { getItem: (key: string) => saved[key] ?? null },
		document: {
			documentElement: {
				setAttribute: (name: string, value: string) =>
					attributes.set(name, value),
			},
		},
	};
	new Function("localStorage", "document", COLOR_THEME_BOOT_SCRIPT)(
		context.localStorage,
		context.document,
	);
	return attributes;
}

describe("colour themes", () => {
	it("has a stylesheet rule for every theme in both schemes", () => {
		for (const theme of COLOR_THEMES) {
			if (theme.id === DEFAULT_COLOR_THEME) continue;
			expect(globalsCss).toContain(
				`:root[data-light-theme="${theme.id}"]:not(.dark)`,
			);
			expect(globalsCss).toContain(`:root.dark[data-dark-theme="${theme.id}"]`);
		}
	});

	it("restores each scheme's saved theme before paint and ignores unknown ids", () => {
		const attributes = runBootScript({
			"diffkit:color-theme:light": "paper",
			"diffkit:color-theme:dark": "not-a-theme",
		});
		expect(attributes.get("data-light-theme")).toBe("paper");
		expect(attributes.has("data-dark-theme")).toBe(false);
	});
});
