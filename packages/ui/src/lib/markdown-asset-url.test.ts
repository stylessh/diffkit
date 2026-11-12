import { afterEach, describe, expect, it, vi } from "vitest";
import { loadableAssetSrcSet, loadableAssetUrl } from "./markdown-asset-url";

function renderingInBrowserAt(origin: string) {
	vi.stubGlobal("window", {
		location: { origin, href: `${origin}/acme/web/pull/1` },
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("loadableAssetUrl", () => {
	it("keeps urls that name another host", () => {
		expect(loadableAssetUrl("https://cdn.test/a.png")).toBe(
			"https://cdn.test/a.png",
		);
		expect(loadableAssetUrl("//cdn.test/a.png")).toBe("//cdn.test/a.png");
	});

	it.each([
		["a path from the site root", "/_serverFn/abc?payload=x"],
		["a path next to the page", "a.png"],
		["a dotted path", "../../api/changes"],
		["a query on the page", "?tab=files"],
		["a fragment", "#readme"],
		["a data url", "data:image/png;base64,AAAA"],
		["a script url", "javascript:alert(1)"],
		["an empty string", "  "],
	])("drops %s, which the browser would send to the app", (_label, url) => {
		expect(loadableAssetUrl(url)).toBeUndefined();
	});

	it("drops a url for the app's own origin, however it is spelled", () => {
		renderingInBrowserAt("https://app.test");

		expect(loadableAssetUrl("https://app.test/_serverFn/abc")).toBeUndefined();
		expect(loadableAssetUrl("HTTPS://APP.TEST/api/changes")).toBeUndefined();
		expect(loadableAssetUrl("//app.test/x.png")).toBeUndefined();
		expect(loadableAssetUrl("https://cdn.test/a.png")).toBe(
			"https://cdn.test/a.png",
		);
	});
});

describe("loadableAssetSrcSet", () => {
	it("keeps the loadable candidates and their descriptors", () => {
		expect(
			loadableAssetSrcSet(
				"/_serverFn/abc 1x, https://cdn.test/a@2x.png 2x, b.png 3x",
				null,
			),
		).toBe("https://cdn.test/a@2x.png 2x");
	});

	it("resolves each candidate before deciding", () => {
		expect(
			loadableAssetSrcSet(
				"a.png 1x, a@2x.png 2x",
				(url) => `https://cdn.test/${url}`,
			),
		).toBe("https://cdn.test/a.png 1x, https://cdn.test/a@2x.png 2x");
	});

	it("is absent when no candidate may load", () => {
		expect(loadableAssetSrcSet("/x 1x, y 2x", null)).toBeUndefined();
	});
});
