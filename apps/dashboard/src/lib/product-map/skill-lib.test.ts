import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderSkillLib } from "../../../../../scripts/build-map-skill.mjs";

const root = path.resolve(import.meta.dirname, "../../../../..");

/**
 * The product-map skill's checker runs a JavaScript copy of these modules in
 * other people's repositories. A stale copy would pass maps DiffKit rejects.
 */
describe("the skill's copy of the map validation", () => {
	it("matches what scripts/build-map-skill.mjs generates today", () => {
		for (const [file, text] of Object.entries(renderSkillLib()))
			expect(readFileSync(path.join(root, file), "utf8"), file).toBe(text);
	});
});
