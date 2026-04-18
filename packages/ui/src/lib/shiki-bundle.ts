import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { diffkitDark, diffkitLight } from "./shiki-themes";

/**
 * Fine-grained Shiki bundle: only these grammars are ever loaded (see shiki.style/guide/bundles).
 * Unknown fence languages fall back to unstyled output via `text` in highlight callers.
 */
export const SHIKI_BUNDLED_LANGS = [
	"javascript",
	"typescript",
	"jsx",
	"tsx",
	"json",
	"html",
	"css",
	"bash",
	"shellscript",
	"python",
	"go",
	"rust",
	"yaml",
	"markdown",
	"diff",
	"sql",
	"graphql",
	"ruby",
	"java",
	"c",
	"cpp",
	"swift",
	"kotlin",
	"dockerfile",
	"toml",
	"vue",
	"svelte",
	"php",
	"csharp",
] as const;

export type ShikiBundledLang = (typeof SHIKI_BUNDLED_LANGS)[number];

const LANG_IMPORTS = {
	javascript: () => import("@shikijs/langs/javascript"),
	typescript: () => import("@shikijs/langs/typescript"),
	jsx: () => import("@shikijs/langs/jsx"),
	tsx: () => import("@shikijs/langs/tsx"),
	json: () => import("@shikijs/langs/json"),
	html: () => import("@shikijs/langs/html"),
	css: () => import("@shikijs/langs/css"),
	bash: () => import("@shikijs/langs/bash"),
	shellscript: () => import("@shikijs/langs/shellscript"),
	python: () => import("@shikijs/langs/python"),
	go: () => import("@shikijs/langs/go"),
	rust: () => import("@shikijs/langs/rust"),
	yaml: () => import("@shikijs/langs/yaml"),
	markdown: () => import("@shikijs/langs/markdown"),
	diff: () => import("@shikijs/langs/diff"),
	sql: () => import("@shikijs/langs/sql"),
	graphql: () => import("@shikijs/langs/graphql"),
	ruby: () => import("@shikijs/langs/ruby"),
	java: () => import("@shikijs/langs/java"),
	c: () => import("@shikijs/langs/c"),
	cpp: () => import("@shikijs/langs/cpp"),
	swift: () => import("@shikijs/langs/swift"),
	kotlin: () => import("@shikijs/langs/kotlin"),
	dockerfile: () => import("@shikijs/langs/dockerfile"),
	toml: () => import("@shikijs/langs/toml"),
	vue: () => import("@shikijs/langs/vue"),
	svelte: () => import("@shikijs/langs/svelte"),
	php: () => import("@shikijs/langs/php"),
	csharp: () => import("@shikijs/langs/csharp"),
} as const satisfies Record<ShikiBundledLang, () => Promise<unknown>>;

export const shikiBundledLangSet = new Set<string>(SHIKI_BUNDLED_LANGS);

export type MarkdownHighlighter = Awaited<
	ReturnType<typeof createHighlighterCore>
>;

export function createMarkdownHighlighter(): Promise<MarkdownHighlighter> {
	return createHighlighterCore({
		themes: [diffkitLight, diffkitDark],
		langs: SHIKI_BUNDLED_LANGS.map((id) => LANG_IMPORTS[id]),
		engine: createJavaScriptRegexEngine(),
	});
}
