import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import {
	type ResourceReference,
	referenceFromProperties,
} from "./markdown-resource-reference";
import { markdownSanitizeSchema } from "./markdown-sanitize-schema";
import { remarkProfileMentions } from "./remark-profile-mentions";
import { remarkResourceReferences } from "./remark-resource-references";

const resolve = (url: string): ResourceReference | null => {
	const m = url.match(/^https:\/\/app\.test\/([^/]+)\/([^/]+)\/pull\/(\d+)$/u);
	if (!m) return null;
	return {
		kind: "pull",
		owner: m[1],
		repo: m[2],
		number: Number(m[3]),
		href: `/${m[1]}/${m[2]}/pull/${m[3]}`,
	};
};

async function render(md: string): Promise<string> {
	const file = await unified()
		.use(remarkParse)
		.use(remarkProfileMentions((login) => `/${login}`))
		.use(remarkGfm)
		.use(remarkResourceReferences(resolve))
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(rehypeSanitize, markdownSanitizeSchema)
		.use(rehypeStringify)
		.process(md);
	return String(file);
}

describe("remarkResourceReferences", () => {
	it("turns a bare resource URL into a dk-reference element", async () => {
		const html = await render("See https://app.test/octocat/hello/pull/42 now");
		expect(html).toContain("<dk-reference");
		expect(html).toContain('kind="pull"');
		expect(html).toContain('owner="octocat"');
		expect(html).toContain('repo="hello"');
		expect(html).toContain('num="42"');
		expect(html).toContain('href="/octocat/hello/pull/42"');
	});

	it("leaves explicit [label](url) links untouched", async () => {
		const html = await render(
			"[the PR](https://app.test/octocat/hello/pull/42)",
		);
		expect(html).not.toContain("<dk-reference");
		expect(html).toContain('<a href="https://app.test/octocat/hello/pull/42"');
		expect(html).toContain(">the PR</a>");
	});

	it("leaves unresolved URLs as ordinary links", async () => {
		const html = await render("https://example.com/some/page");
		expect(html).not.toContain("<dk-reference");
		expect(html).toContain('<a href="https://example.com/some/page"');
	});
});

describe("remarkProfileMentions", () => {
	it("emits a dk-mention element for @login", async () => {
		const html = await render("hey @octocat thanks");
		expect(html).toContain("<dk-mention");
		expect(html).toContain('login="octocat"');
		expect(html).toContain('href="/octocat"');
		expect(html).toContain(">@octocat</dk-mention>");
	});

	it("does not treat email-like text as a mention", async () => {
		const html = await render("contact me@example.com please");
		expect(html).not.toContain("<dk-mention");
	});

	it("preserves mentions around nested formatting", async () => {
		const html = await render("@first **and @second** then @third");
		expect(html).toContain('login="first"');
		expect(html).toContain('<strong>and <dk-mention href="/second"');
		expect(html).toContain('login="third"');
	});

	it("does not create nested links for formatted mentions", async () => {
		const html = await render("[**@octocat**](/profile)");
		expect(html).not.toContain("<dk-mention");
		expect(html.match(/<a\b/gu)).toHaveLength(1);
	});
});

describe("referenceFromProperties", () => {
	it("rejects references without a destination", () => {
		expect(
			referenceFromProperties({ kind: "user", login: "octocat" }),
		).toBeNull();
	});

	it("rejects missing, noncanonical, and unsafe issue numbers", () => {
		const base = { kind: "issue", href: "/issue", owner: "acme", repo: "repo" };
		for (const num of [undefined, "0", "01", "-1", "9007199254740992"]) {
			expect(referenceFromProperties({ ...base, num })).toBeNull();
		}
	});
});

describe("reference pipeline safety", () => {
	it("never produces references or mentions from dangerous links", async () => {
		const html = await render(
			'[x](javascript:alert(1)) and <a href="javascript:alert(2)">y</a>',
		);
		expect(html.toLowerCase()).not.toContain("javascript:");
		expect(html).not.toContain("<dk-reference");
	});
});
