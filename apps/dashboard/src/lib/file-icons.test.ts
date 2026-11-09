import { describe, expect, it } from "vitest";
import { resolveFileIcon } from "./file-icons";

describe("resolveFileIcon", () => {
	it("picks an icon and hue by file type", () => {
		expect(resolveFileIcon("src/lib/file-icons.ts")).toMatchObject({
			token: "typescript",
			hue: "blue",
		});
		expect(resolveFileIcon("install.sh")).toMatchObject({
			token: "bash",
			hue: "green",
		});
		expect(resolveFileIcon("docs/README.md")).toMatchObject({
			token: "markdown",
			hue: "green",
		});
		expect(resolveFileIcon("Dockerfile").token).toBe("docker");
	});

	it("draws an unknown type with the gray default icon", () => {
		const icon = resolveFileIcon("notes.qqqzzz");
		expect(icon).toMatchObject({ token: "default", hue: "gray" });
		expect(icon.body).toContain("<path");
	});

	it("scopes an icon's internal ids so two icons on a page cannot clash", () => {
		const { body } = resolveFileIcon("next.config.js");
		const ids = [...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
		const refs = [...body.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);

		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(id).toMatch(/^file-tree-builtin-nextjs-/);
		for (const ref of refs) expect(ids).toContain(ref);
	});
});
