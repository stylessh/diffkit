import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it, vi } from "vitest";
import { markdownSanitizeSchema } from "./markdown-sanitize-schema";
import { remarkRepoNumberReferences } from "./remark-repo-number-references";

async function render(
	md: string,
	resolve: (
		number: number,
	) => import("./markdown-resource-reference").ResourceReference | null,
) {
	const file = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRepoNumberReferences(resolve))
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(rehypeSanitize, markdownSanitizeSchema)
		.use(rehypeStringify)
		.process(md);
	return String(file);
}

describe("remarkRepoNumberReferences", () => {
	it("turns #123 into a link when resolved", async () => {
		const html = await render("See #42 for context", (n) =>
			n === 42
				? {
						kind: "pull" as const,
						owner: "acme",
						repo: "repo",
						number: 42,
						href: "/acme/repo/pull/42",
					}
				: null,
		);
		expect(html).toContain('href="/acme/repo/pull/42"');
		expect(html).toContain("#42");
	});

	it("leaves unresolved numbers as plain text", async () => {
		const html = await render("See #99 for context", () => null);
		expect(html).toContain("#99");
		expect(html).not.toContain('href="/');
	});

	it("leaves ##42 as a literal #42", async () => {
		const html = await render("Use ##42 literally", (n) =>
			n === 42
				? {
						kind: "pull" as const,
						owner: "acme",
						repo: "repo",
						number: 42,
						href: "/acme/repo/pull/42",
					}
				: null,
		);
		expect(html).toContain("#42");
		expect(html).not.toContain("##42");
		expect(html).not.toContain('href="/acme/repo/pull/42"');
	});

	it("preserves references around nested formatting", async () => {
		const html = await render("#41 **and #42** then #43", (number) => ({
			kind: "issue",
			owner: "acme",
			repo: "repo",
			number,
			href: `/acme/repo/issues/${number}`,
		}));
		expect(html).toContain("#41");
		expect(html).toContain("<strong>and <dk-reference");
		expect(html).toContain("#43");
	});

	it("does not create nested links for formatted references", async () => {
		const html = await render("[**#42**](/target)", (number) => ({
			kind: "issue",
			owner: "acme",
			repo: "repo",
			number,
			href: `/acme/repo/issues/${number}`,
		}));
		expect(html).not.toContain("<dk-reference");
		expect(html.match(/<a\b/gu)).toHaveLength(1);
	});

	it("preserves unsafe-size numbers without resolving them", async () => {
		const resolve = vi.fn(() => null);
		const html = await render(
			"See #9007199254740993 and ##999999999999999999999999 literally",
			resolve,
		);
		expect(resolve).not.toHaveBeenCalled();
		expect(html).toContain("#9007199254740993");
		expect(html).toContain("#999999999999999999999999");
		expect(html).not.toContain("Infinity");
	});
});
