import { describe, expect, it } from "vitest";
import { resolveGitHubMarkdownAssetUrl } from "./repo-markdown-files";

describe("resolveGitHubMarkdownAssetUrl", () => {
	const context = {
		owner: "jakemor",
		repo: "kanna",
		ref: "main",
		path: "README.md",
	};

	it("rebases root README relative assets to GitHub raw content", () => {
		expect(
			resolveGitHubMarkdownAssetUrl(context, "assets/screenshot.png"),
		).toBe(
			"https://raw.githubusercontent.com/jakemor/kanna/main/assets/screenshot.png",
		);
	});

	it("rebases root-relative assets from the repository root", () => {
		expect(resolveGitHubMarkdownAssetUrl(context, "/assets/icon.png")).toBe(
			"https://raw.githubusercontent.com/jakemor/kanna/main/assets/icon.png",
		);
	});

	it("resolves nested README assets relative to the markdown file", () => {
		expect(
			resolveGitHubMarkdownAssetUrl(
				{ ...context, path: "docs/guides/README.md" },
				"../assets/demo image.png",
			),
		).toBe(
			"https://raw.githubusercontent.com/jakemor/kanna/main/docs/assets/demo%20image.png",
		);
	});

	it("handles refs with slashes (e.g. feature branches)", () => {
		expect(
			resolveGitHubMarkdownAssetUrl(
				{ ...context, ref: "feature/auth" },
				"assets/screenshot.png",
			),
		).toBe(
			"https://raw.githubusercontent.com/jakemor/kanna/feature/auth/assets/screenshot.png",
		);
	});

	it("keeps absolute and anchor URLs unchanged", () => {
		expect(
			resolveGitHubMarkdownAssetUrl(
				context,
				"https://img.shields.io/badge.svg",
			),
		).toBe("https://img.shields.io/badge.svg");
		expect(
			resolveGitHubMarkdownAssetUrl(context, "//example.com/badge.svg"),
		).toBe("//example.com/badge.svg");
		expect(resolveGitHubMarkdownAssetUrl(context, "#install")).toBe("#install");
	});
});
