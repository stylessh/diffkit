import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

type MarkdownProps = Omit<Parameters<typeof Markdown>[0], "children">;

function render(source: string, props: MarkdownProps = {}) {
	return renderToStaticMarkup(
		createElement(Markdown, props as Parameters<typeof Markdown>[0], source),
	);
}

describe("Markdown", () => {
	it("renders GFM", () => {
		const html = render("**bold** and ~~gone~~\n\n- [x] done");
		expect(html).toContain("<strong");
		expect(html).toContain("<del");
		expect(html).toContain('type="checkbox"');
	});

	it("sanitizes raw HTML", () => {
		const html = render(
			'<script>alert(1)</script><img src="https://a.test/x.png" onerror="alert(2)"><a href="javascript:alert(3)">x</a>',
		);
		expect(html).not.toMatch(/<script/i);
		expect(html).not.toMatch(/onerror/i);
		expect(html).not.toMatch(/javascript:/i);
	});

	it("keeps GitHub alerts with their icon after sanitizing", () => {
		const html = render("> [!WARNING]\n> careful");
		expect(html).toContain("markdown-alert");
		expect(html).toContain("markdown-alert-warning");
		expect(html).toContain("markdown-alert-title");
		expect(html).toContain('class="octicon"');
		expect(html).toContain("careful");
	});

	it("does not let user markup smuggle in an svg", () => {
		const html = render('<svg onload="alert(1)"><path d="M0 0"/></svg>');
		expect(html).not.toMatch(/<svg/i);
		expect(html).not.toMatch(/onload/i);
	});

	it("links @mentions through resolveMentionHref", () => {
		const html = render("hi @octocat!", {
			resolveMentionHref: (login: string) => `https://github.com/${login}`,
		});
		expect(html).toContain('href="https://github.com/octocat"');
		expect(html).toContain("@octocat");
	});

	it("links #123 through resolveRepoNumberReference", () => {
		const html = render("fixes #42", {
			resolveRepoNumberReference: (number: number) => ({
				kind: "issue" as const,
				href: `https://github.com/o/r/issues/${number}`,
				owner: "o",
				repo: "r",
				number,
			}),
		});
		expect(html).toContain('href="https://github.com/o/r/issues/42"');
	});

	it("opens external links in a new tab but not same-document anchors", () => {
		const html = render("[ext](https://example.com) [here](#section)");
		expect(html).toContain('target="_blank"');
		const anchor = html.match(/<a[^>]*href="#section"[^>]*>/)?.[0] ?? "";
		expect(anchor).not.toContain("_blank");
	});

	it("resolves asset urls", () => {
		const html = render("![x](a.png)", {
			resolveAssetUrl: (url: string) => `https://cdn.test/${url}`,
		});
		expect(html).toContain('src="https://cdn.test/a.png"');
	});
});
