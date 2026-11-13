import { describe, expect, it } from "vitest";
import { detectLang } from "./languages";

describe("detectLang", () => {
	it("maps known file names and extensions", () => {
		expect(detectLang("src/app.tsx")).toBe("tsx");
		expect(detectLang("config/.env.example")).toBe("bash");
	});

	it("returns a language name for files named after object properties", () => {
		expect(detectLang("src/constructor")).toBe("text");
		expect(detectLang("notes.toString")).toBe("text");
		expect(detectLang("__proto__")).toBe("text");
	});
});
