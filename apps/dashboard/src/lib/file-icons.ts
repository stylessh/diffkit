import {
	createFileTreeIconResolver,
	getBuiltInSpriteSheet,
} from "@pierre/trees";

/**
 * File type icons from Pierre's trees (https://trees.software), Apache-2.0:
 * the package resolves a path to an icon and ships the icons as an SVG sprite.
 * Each icon draws in `currentColor`; its hue comes from the theme's
 * `--file-icon-*` tokens.
 */

export const FILE_ICON_SET = "complete";

export type FileIconHue =
	| "blue"
	| "cyan"
	| "gray"
	| "green"
	| "indigo"
	| "mauve"
	| "orange"
	| "pink"
	| "purple"
	| "red"
	| "teal"
	| "vermilion"
	| "yellow";

/** Pierre's own colouring, from its `--trees-file-icon-color-*` rules. */
const TOKEN_HUE: Readonly<Record<string, FileIconHue>> = {
	astro: "purple",
	babel: "yellow",
	bash: "green",
	biome: "blue",
	bootstrap: "indigo",
	browserslist: "yellow",
	bun: "mauve",
	c: "blue",
	claude: "orange",
	cpp: "blue",
	css: "indigo",
	database: "purple",
	default: "gray",
	docker: "blue",
	eslint: "indigo",
	git: "vermilion",
	go: "cyan",
	graphql: "pink",
	html: "orange",
	image: "pink",
	javascript: "yellow",
	json: "orange",
	markdown: "green",
	mcp: "teal",
	npm: "red",
	oxc: "cyan",
	postcss: "red",
	prettier: "teal",
	python: "blue",
	react: "cyan",
	ruby: "red",
	rust: "orange",
	sass: "pink",
	svelte: "red",
	svg: "orange",
	svgo: "green",
	swift: "orange",
	table: "teal",
	tailwind: "cyan",
	terraform: "indigo",
	text: "gray",
	typescript: "blue",
	vite: "purple",
	vscode: "blue",
	vue: "green",
	wasm: "indigo",
	webpack: "blue",
	yml: "red",
	zig: "orange",
	zip: "orange",
};

export type FileIconGlyph = {
	token: string;
	hue: FileIconHue;
	viewBox: string;
	/** The symbol's SVG markup, with its internal ids made unique to it. */
	body: string;
};

const SYMBOL = /<symbol id="([^"]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g;

const resolver = createFileTreeIconResolver({
	set: FILE_ICON_SET,
	colored: true,
});
let symbols: Map<string, { viewBox: string; body: string }> | undefined;

function spriteSymbols() {
	if (symbols) return symbols;
	symbols = new Map();
	for (const [, id, viewBox, body] of getBuiltInSpriteSheet(
		FILE_ICON_SET,
	).matchAll(SYMBOL)) {
		const scoped = body
			.replace(/\bid="([^"]+)"/g, `id="${id}-$1"`)
			.replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`);
		symbols.set(id, { viewBox, body: scoped.trim() });
	}
	return symbols;
}

export function resolveFileIcon(path: string): FileIconGlyph {
	const icon = resolver.resolveIcon("file-tree-icon-file", path);
	const token = icon.token ?? "default";
	const symbol =
		spriteSymbols().get(icon.name) ??
		spriteSymbols().get("file-tree-icon-file");
	if (!symbol) throw new Error(`file icon sprite has no ${icon.name}`);
	return {
		token,
		hue: TOKEN_HUE[token] ?? "gray",
		viewBox: symbol.viewBox,
		body: symbol.body,
	};
}
