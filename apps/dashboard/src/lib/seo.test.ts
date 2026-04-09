import { describe, expect, it } from "vitest";
import { buildSeo, summarizeText, toAbsoluteUrl } from "./seo";

describe("summarizeText", () => {
	it("strips basic markdown and whitespace", () => {
		expect(
			summarizeText(
				"# Heading\n\nTrack [pull requests](https://example.com) with `fast` reviews.",
			),
		).toBe("Heading Track pull requests with reviews.");
	});

	it("falls back when the source is empty", () => {
		expect(summarizeText("   ", "Fallback text")).toBe("Fallback text");
	});
});

describe("toAbsoluteUrl", () => {
	it("joins a site url and path", () => {
		expect(toAbsoluteUrl("https://diffkit.app", "/login")).toBe(
			"https://diffkit.app/login",
		);
	});
});

describe("buildSeo", () => {
	it("returns canonical links and noindex robots directives", () => {
		const seo = buildSeo({
			siteUrl: "https://diffkit.app",
			path: "/pulls",
			title: "Pull Requests | DiffKit",
			description: "Private pull request dashboard.",
			robots: "noindex",
		});

		expect(seo.links).toEqual([
			{ rel: "canonical", href: "https://diffkit.app/pulls" },
		]);
		expect(seo.meta).toContainEqual({
			name: "robots",
			content: "noindex, nofollow, noarchive",
		});
		expect(seo.meta).toContainEqual({
			property: "og:url",
			content: "https://diffkit.app/pulls",
		});
	});
});
