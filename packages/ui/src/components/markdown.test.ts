import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
	MarkdownTextReference,
	ResourceReference,
} from "../lib/markdown-resource-reference";
import { Markdown, type MarkdownReferenceProps } from "./markdown";

type MarkdownProps = Omit<Parameters<typeof Markdown>[0], "children">;

function render(source: string, props: MarkdownProps = {}) {
	return renderToStaticMarkup(
		createElement(Markdown, props as Parameters<typeof Markdown>[0], source),
	);
}

const CURRENT_REPO = { owner: "acme", repo: "web" };

function resolveTextReference(
	token: MarkdownTextReference,
): ResourceReference | null {
	const { owner, repo } = token.repo ?? CURRENT_REPO;
	if (token.kind === "number") {
		return {
			kind: "issueOrPull",
			owner,
			repo,
			number: token.number,
			href: `/${owner}/${repo}/issues/${token.number}`,
		};
	}
	return {
		kind: "commit",
		owner,
		repo,
		sha: token.sha,
		href: `/${owner}/${repo}/commit/${token.sha}`,
	};
}

function resolveReference(url: string): ResourceReference | null {
	const match = url.match(
		/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/u,
	);
	if (!match) {
		return null;
	}
	const [, owner, repo, number] = match;
	return {
		kind: "pull",
		owner,
		repo,
		number: Number(number),
		href: `/${owner}/${repo}/pull/${number}`,
	};
}

function ReferenceProbe({
	reference,
	origin,
	children,
}: MarkdownReferenceProps) {
	const { href: _, ...identity } = reference;
	return createElement(
		"ref",
		{ "data-ref": JSON.stringify({ ...identity, origin }) },
		children,
	);
}

function renderComment(source: string) {
	return render(source, {
		resolveTextReference,
		resolveReference,
		resolveMentionHref: (login: string) => `/${login}`,
		referenceComponent: ReferenceProbe,
	});
}

function referencesIn(html: string) {
	return [...html.matchAll(/data-ref="([^"]+)">([^<]*)</gu)].map(
		([, json, label]) => ({
			...JSON.parse(json.replaceAll("&quot;", '"')),
			label,
		}),
	);
}

function mentionsIn(html: string) {
	return [...html.matchAll(/<a [^>]*href="\/([^"]+)"[^>]*>@/gu)].map(
		([, login]) => login,
	);
}

describe("Markdown references", () => {
	it("autolinks the references GitHub autolinks in a comment", () => {
		const html = renderComment(
			[
				"Thanks @octo-cat! Fixes #12 and acme/api#7, see https://github.com/acme/api/pull/9.",
				"Regressed in 1a2b3c4d5e6f and acme/api@9f8e7d6c5b4a3210.",
			].join("\n"),
		);

		expect(referencesIn(html)).toEqual([
			{
				kind: "issueOrPull",
				owner: "acme",
				repo: "web",
				number: 12,
				origin: "text",
				label: "#12",
			},
			{
				kind: "issueOrPull",
				owner: "acme",
				repo: "api",
				number: 7,
				origin: "text",
				label: "acme/api#7",
			},
			{
				kind: "pull",
				owner: "acme",
				repo: "api",
				number: 9,
				origin: "url",
				label: "acme/api#9",
			},
			{
				kind: "commit",
				owner: "acme",
				repo: "web",
				sha: "1a2b3c4d5e6f",
				origin: "text",
				label: "1a2b3c4",
			},
			{
				kind: "commit",
				owner: "acme",
				repo: "api",
				sha: "9f8e7d6c5b4a3210",
				origin: "text",
				label: "acme/api@9f8e7d6",
			},
		]);
		expect(mentionsIn(html)).toEqual(["octo-cat"]);
	});

	it("leaves look-alikes as text", () => {
		const html = renderComment(
			[
				"mail me@example.com, ping @acme/reviewers, color #fff and a#1,",
				"hex words deadbeef or defaced, the year 2026110, `#5` in code,",
				"and an [explicit #4 link](https://example.com).",
				"",
				"```",
				"#8 @octocat 1a2b3c4d",
				"```",
			].join("\n"),
		);

		expect(referencesIn(html)).toEqual([]);
		expect(mentionsIn(html)).toEqual([]);
		expect(html).toContain("@acme/reviewers");
	});
});

describe("Markdown documents", () => {
	it("renders task lists, aligned tables, footnotes and fenced code", () => {
		const html = render(
			[
				"- [x] ship it",
				"- [ ] write the changelog[^1]",
				"",
				"| Left | Right |",
				"| :--- | ----: |",
				"| a | b |",
				"",
				"```ts",
				"const answer = 42;",
				"```",
				"",
				"[^1]: Before Friday.",
			].join("\n"),
		);

		expect(html.match(/type="checkbox"/gu)).toHaveLength(2);
		expect(html).toMatch(/<input[^>]*checked=""/u);
		expect(html).toContain('style="text-align:right"');
		expect(html).toContain("const answer = 42;");

		const refHref = html.match(/href="#([^"]+)"[^>]*data-footnote-ref/u)?.[1];
		const backHref = html.match(
			/href="#([^"]+)"[^>]*data-footnote-backref/u,
		)?.[1];
		expect(refHref).toBeDefined();
		expect(html).toContain(`id="${refHref}"`);
		expect(html).toContain(`id="${backHref}"`);
	});

	it("keeps GitHub alerts with their icon after sanitizing", () => {
		const html = render("> [!WARNING]\n> careful");
		expect(html).toContain("markdown-alert-warning");
		expect(html).toContain('class="octicon"');
		expect(html).toContain("careful");
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

describe("Markdown sanitizing", () => {
	it("strips scripts, handlers and javascript: urls", () => {
		const html = renderComment(
			'<script>alert(1)</script><img src="https://a.test/x.png" onerror="alert(2)"><a href="javascript:alert(3)">x</a>\n\n[y](javascript:alert(4))',
		);
		expect(html).not.toMatch(/<script/i);
		expect(html).not.toMatch(/onerror/i);
		expect(html).not.toMatch(/javascript:/i);
		expect(referencesIn(html)).toEqual([]);
	});

	it("does not let user markup smuggle in an svg", () => {
		const html = render('<svg onload="alert(1)"><path d="M0 0"/></svg>');
		expect(html).not.toMatch(/<svg/i);
		expect(html).not.toMatch(/onload/i);
	});

	it("drops raw reference elements a comment author writes by hand", () => {
		const html = renderComment(
			'<dk-reference kind="commit" href="/x" owner="a" repo="b" sha="zzzzzzz">raw</dk-reference>',
		);
		expect(referencesIn(html)).toEqual([]);
	});
});
