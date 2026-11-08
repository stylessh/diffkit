import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { markdownSanitizeSchema } from "./markdown-sanitize-schema";

/** Same remark/rehype stack as the Markdown component (without React). */
async function markdownToSafeHtml(md: string): Promise<string> {
	const file = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkAlert, { tagName: "blockquote" })
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(rehypeSanitize, markdownSanitizeSchema)
		.use(rehypeStringify)
		.process(md);
	return String(file);
}

describe("markdown pipeline XSS (rehype-raw + rehype-sanitize)", () => {
	it("strips script tags and inline script payloads", async () => {
		const html = await markdownToSafeHtml(`
Hello

<script>alert('xss')</script>

<script type="module" src="https://evil.test/b.js"></script>
`);
		expect(html.toLowerCase()).not.toMatch(/<script\b/);
		expect(html).not.toMatch(/alert\(/);
	});

	it("strips event handler attributes from raw HTML", async () => {
		const html = await markdownToSafeHtml(`
<img src="https://example.com/x.png" onerror="alert(1)" />

<div onclick="alert(2)">click</div>
`);
		expect(html.toLowerCase()).not.toMatch(/onerror\s*=/);
		expect(html.toLowerCase()).not.toMatch(/onclick\s*=/);
	});

	it("drops javascript: and other dangerous link protocols", async () => {
		const html = await markdownToSafeHtml(`
[a](javascript:alert('bad'))

<a href="javascript:alert('bad')">x</a>
`);
		expect(html.toLowerCase()).not.toMatch(/javascript:/);
	});

	it("strips iframe srcdoc payload (no script / onerror reaches output)", async () => {
		const html = await markdownToSafeHtml(`
<iframe srcdoc="<script>parent.document.body.innerHTML='pwned'</script>"></iframe>

<iframe srcdoc="<img src=x onerror=alert(1)>"></iframe>
`);
		expect(html.toLowerCase()).not.toMatch(/srcdoc\s*=/);
		expect(html.toLowerCase()).not.toMatch(/<script\b/);
		expect(html.toLowerCase()).not.toMatch(/onerror\s*=/);
		expect(html.toLowerCase()).not.toMatch(/parent\.document/);
	});

	it("strips nested raw HTML and event handlers inside divs", async () => {
		const html = await markdownToSafeHtml(`
Intro paragraph.

<div class="wrap">
  <span title="x" onmouseover="alert('nested')">hover</span>
  <p><img src="x" onerror="alert('deep')"></p>
</div>

After.
`);
		expect(html.toLowerCase()).not.toMatch(/onmouseover\s*=/);
		expect(html.toLowerCase()).not.toMatch(/onerror\s*=/);
	});

	it("drops javascript: with scheme obfuscation (mixed case, entities)", async () => {
		const html = await markdownToSafeHtml(`
[a](JavaScript:alert('bad'))

<a href="javascript:void(0)">one</a>
<a href="&#106;avascript:alert(1)">entity href</a>
`);
		const lower = html.toLowerCase();
		expect(lower).not.toMatch(/javascript:/);
		expect(lower).not.toMatch(/void\(0\)/);
		expect(html).not.toMatch(/alert\(/);
	});

	it("blocks data: and blob: image URLs (not http/https)", async () => {
		const html = await markdownToSafeHtml(`
<img alt="d" src="data:text/html,<script>alert(1)</script>">

<img src="blob:https://example.com/00000000-0000-0000-0000-000000000000">
`);
		expect(html.toLowerCase()).not.toMatch(/data:/);
		expect(html.toLowerCase()).not.toMatch(/blob:/);
		expect(html.toLowerCase()).not.toMatch(/<script\b/);
	});

	it("drops javascript: iframe src and keeps https iframe src intact", async () => {
		const html = await markdownToSafeHtml(`
<iframe src="javascript:alert(1)"></iframe>
<iframe src="https://example.com/embed"></iframe>
`);
		expect(html.toLowerCase()).not.toMatch(/javascript:/);
		expect(html).toContain("https://example.com/embed");
	});

	it("removes high-risk tags: svg scripts, object/embed, meta refresh, base", async () => {
		const html = await markdownToSafeHtml(`
<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>
<svg onload="alert(2)"></svg>
<object data="https://evil.test/x.swf"></object>
<embed src="https://evil.test/x.swf">
<link rel="stylesheet" href="javascript:alert(1)">
<meta http-equiv="refresh" content="0;url=javascript:alert(1)">
<base href="https://evil.test/">
`);
		expect(html.toLowerCase()).not.toMatch(/<script\b/);
		expect(html.toLowerCase()).not.toMatch(/<svg\b/);
		expect(html.toLowerCase()).not.toMatch(/onload\s*=/);
		expect(html.toLowerCase()).not.toMatch(/<object\b/);
		expect(html.toLowerCase()).not.toMatch(/<embed\b/);
		expect(html.toLowerCase()).not.toMatch(/<link\b/);
		expect(html.toLowerCase()).not.toMatch(/<meta\b/);
		expect(html.toLowerCase()).not.toMatch(/<base\b/);
		expect(html.toLowerCase()).not.toMatch(/javascript:/);
	});

	it("removes style elements so rules are not applied as a stylesheet", async () => {
		const html = await markdownToSafeHtml(`
<style>body{background:url('javascript:alert(1)')}</style>
<p>after</p>
`);
		expect(html.toLowerCase()).not.toMatch(/<style\b/);
		expect(html).toContain("after");
		// Sanitizer drops the <style> node; inner CSS may remain as plain text (inert).
	});

	it("strips dangerous form actions and vbscript hrefs", async () => {
		const html = await markdownToSafeHtml(`
<form action="javascript:alert(1)"><input type="submit"></form>
<a href="vbscript:msgbox(1)">vb</a>
`);
		expect(html.toLowerCase()).not.toMatch(/javascript:/);
		expect(html.toLowerCase()).not.toMatch(/vbscript:/);
		expect(html.toLowerCase()).not.toMatch(/<form\b/);
	});

	it("strips uncommon event-handler attributes on allowed elements", async () => {
		const html = await markdownToSafeHtml(`
<p onauxclick="alert(1)">aux</p>
<a href="https://example.com" onfocus="alert(2)">link</a>
<img src="https://example.com/z.png" onpointerdown="alert(3)" alt="">
`);
		expect(html.toLowerCase()).not.toMatch(/onauxclick\s*=/);
		expect(html.toLowerCase()).not.toMatch(/onfocus\s*=/);
		expect(html.toLowerCase()).not.toMatch(/onpointerdown\s*=/);
		expect(html).toContain("https://example.com");
	});

	it("sanitizes raw HTML inside GFM table cells", async () => {
		const html = await markdownToSafeHtml(`
| A | B |
| - | - |
| x | <img src=x onerror=alert(1)> |

Plain after table.
`);
		expect(html.toLowerCase()).not.toMatch(/onerror\s*=/);
		expect(html).toContain("Plain after table");
	});

	it("neutralizes template and slot tags (declarative shadow / mutation gadgets)", async () => {
		const html = await markdownToSafeHtml(`
<template><script>alert(1)</script></template>
<slot name="x" onclick="alert(2)"></slot>
`);
		expect(html.toLowerCase()).not.toMatch(/<template\b/);
		expect(html.toLowerCase()).not.toMatch(/<slot\b/);
		expect(html.toLowerCase()).not.toMatch(/<script\b/);
		expect(html.toLowerCase()).not.toMatch(/onclick\s*=/);
	});

	it("handles markdown+HTML mixing and duplicate attack blocks", async () => {
		const html = await markdownToSafeHtml(`
**bold** then raw: <img src="https://a.test/i.png" onload="alert(1)">

> quote
> <script>alert(2)</script>

`);
		expect(html.toLowerCase()).not.toMatch(/onload\s*=/);
		expect(html.toLowerCase()).not.toMatch(/<script\b/);
		expect(html).toContain("<strong>bold</strong>");
	});

	it("sanitizes a stacked multi-vector payload in one document", async () => {
		const html = await markdownToSafeHtml(`
# Hi

[a](javascript:alert('md'))

<img src=x onerror=alert(1)>

<svg><animate onbegin=alert(1)></animate></svg>

<iframe srcdoc="<body onload=alert(1)>"></iframe>

***Legit bold*** and [ok](https://safe.example/path).

<blockquote class="markdown-alert markdown-alert-note">
<p>Note: user alert in prose should stay — alert(9) in text.</p>
</blockquote>
`);
		expect(html.toLowerCase()).not.toMatch(/javascript:/);
		expect(html.toLowerCase()).not.toMatch(/onerror\s*=/);
		expect(html.toLowerCase()).not.toMatch(/onbegin\s*=/);
		expect(html.toLowerCase()).not.toMatch(/onload\s*=/);
		expect(html.toLowerCase()).not.toMatch(/srcdoc\s*=/);
		expect(html.toLowerCase()).not.toMatch(/<svg\b/);
		expect(html).toContain("https://safe.example/path");
		expect(html).toContain("markdown-alert");
		expect(html).toContain("alert(9)");
	});

	it("preserves GitHub alert classes from blockquote syntax", async () => {
		const html = await markdownToSafeHtml(`
> [!NOTE]
> Keep this visible.
`);
		expect(html).toContain("markdown-alert");
		expect(html).toContain("markdown-alert-note");
		expect(html).toContain("markdown-alert-title");
		expect(html).toContain("Keep this visible.");
	});

	it("still renders benign markdown", async () => {
		const html = await markdownToSafeHtml(
			"Hello **world** and [link](https://example.com).",
		);
		expect(html).toContain("<strong>world</strong>");
		expect(html).toContain('href="https://example.com"');
	});
});
