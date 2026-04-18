import type { ThemeRegistrationRaw } from "shiki";

const diffkitLightTokens: ThemeRegistrationRaw["tokenColors"] = [
	{
		scope: ["comment", "punctuation.definition.comment"],
		settings: { foreground: "#666666", fontStyle: "italic" },
	},
	{
		scope: ["keyword", "storage", "storage.type", "storage.modifier"],
		settings: { foreground: "#c41562" },
	},
	{
		scope: ["string", "string.quoted", "string.template", "string.regexp"],
		settings: { foreground: "#107d32" },
	},
	{
		scope: [
			"constant",
			"constant.numeric",
			"constant.language",
			"constant.character",
		],
		settings: { foreground: "#005ff2" },
	},
	{
		scope: ["entity.name.function", "support.function", "meta.function-call"],
		settings: { foreground: "#7d00cc" },
	},
	{
		scope: [
			"variable.parameter",
			"meta.parameter",
			"entity.name.variable.parameter",
		],
		settings: { foreground: "#aa4d00" },
	},
	{
		scope: [
			"variable.other.property",
			"support.type.property-name",
			"entity.name.tag",
			"meta.object-literal.key",
		],
		settings: { foreground: "#005ff2" },
	},
	{
		scope: [
			"entity.name.type",
			"entity.name.class",
			"support.type",
			"support.class",
		],
		settings: { foreground: "#005ff2" },
	},
	{
		scope: ["punctuation", "meta.brace", "meta.bracket"],
		settings: { foreground: "#171717" },
	},
	{
		scope: ["variable", "variable.other"],
		settings: { foreground: "#171717" },
	},
	{
		scope: [
			"entity.other.attribute-name",
			"entity.other.attribute-name.jsx",
			"entity.other.attribute-name.tsx",
		],
		settings: { foreground: "#aa4d00" },
	},
	{
		scope: ["markup.deleted", "punctuation.definition.deleted"],
		settings: { foreground: "#c41562" },
	},
	{
		scope: ["markup.inserted", "punctuation.definition.inserted"],
		settings: { foreground: "#107d32" },
	},
	// Markdown-specific scopes
	{
		scope: [
			"markup.heading",
			"markup.heading.setext",
			"punctuation.definition.heading",
		],
		settings: { foreground: "#005ff2", fontStyle: "bold" },
	},
	{
		scope: ["markup.bold", "punctuation.definition.bold"],
		settings: { fontStyle: "bold" },
	},
	{
		scope: ["markup.italic", "punctuation.definition.italic"],
		settings: { fontStyle: "italic" },
	},
	{
		scope: [
			"markup.inline.raw",
			"markup.fenced_code",
			"markup.raw",
			"fenced_code.block.language",
		],
		settings: { foreground: "#c41562" },
	},
	{
		scope: ["markup.quote", "punctuation.definition.quote.begin"],
		settings: { foreground: "#666666", fontStyle: "italic" },
	},
	{
		scope: [
			"markup.list",
			"punctuation.definition.list.begin",
			"punctuation.definition.list_item",
		],
		settings: { foreground: "#aa4d00" },
	},
	{
		scope: ["markup.underline.link", "meta.link.inline", "string.other.link"],
		settings: { foreground: "#005ff2", fontStyle: "underline" },
	},
	{
		scope: [
			"meta.link.reference",
			"string.other.link.title",
			"string.other.link.description",
		],
		settings: { foreground: "#7d00cc" },
	},
	{
		scope: ["meta.separator", "markup.hr"],
		settings: { foreground: "#666666" },
	},
];

const diffkitDarkTokens: ThemeRegistrationRaw["tokenColors"] = [
	{
		scope: ["comment", "punctuation.definition.comment"],
		settings: { foreground: "#a1a1a1", fontStyle: "italic" },
	},
	{
		scope: ["keyword", "storage", "storage.type", "storage.modifier"],
		settings: { foreground: "#ff4d8d" },
	},
	{
		scope: ["string", "string.quoted", "string.template", "string.regexp"],
		settings: { foreground: "#00ca50" },
	},
	{
		scope: [
			"constant",
			"constant.numeric",
			"constant.language",
			"constant.character",
		],
		settings: { foreground: "#47a8ff" },
	},
	{
		scope: ["entity.name.function", "support.function", "meta.function-call"],
		settings: { foreground: "#c472fb" },
	},
	{
		scope: [
			"variable.parameter",
			"meta.parameter",
			"entity.name.variable.parameter",
		],
		settings: { foreground: "#ff9300" },
	},
	{
		scope: [
			"variable.other.property",
			"support.type.property-name",
			"entity.name.tag",
			"meta.object-literal.key",
		],
		settings: { foreground: "#47a8ff" },
	},
	{
		scope: [
			"entity.name.type",
			"entity.name.class",
			"support.type",
			"support.class",
		],
		settings: { foreground: "#47a8ff" },
	},
	{
		scope: ["punctuation", "meta.brace", "meta.bracket"],
		settings: { foreground: "#ededed" },
	},
	{
		scope: ["variable", "variable.other"],
		settings: { foreground: "#ededed" },
	},
	{
		scope: [
			"entity.other.attribute-name",
			"entity.other.attribute-name.jsx",
			"entity.other.attribute-name.tsx",
		],
		settings: { foreground: "#ff9300" },
	},
	{
		scope: ["markup.deleted", "punctuation.definition.deleted"],
		settings: { foreground: "#ff4d8d" },
	},
	{
		scope: ["markup.inserted", "punctuation.definition.inserted"],
		settings: { foreground: "#00ca50" },
	},
	// Markdown-specific scopes
	{
		scope: [
			"markup.heading",
			"markup.heading.setext",
			"punctuation.definition.heading",
		],
		settings: { foreground: "#47a8ff", fontStyle: "bold" },
	},
	{
		scope: ["markup.bold", "punctuation.definition.bold"],
		settings: { fontStyle: "bold" },
	},
	{
		scope: ["markup.italic", "punctuation.definition.italic"],
		settings: { fontStyle: "italic" },
	},
	{
		scope: [
			"markup.inline.raw",
			"markup.fenced_code",
			"markup.raw",
			"fenced_code.block.language",
		],
		settings: { foreground: "#ff4d8d" },
	},
	{
		scope: ["markup.quote", "punctuation.definition.quote.begin"],
		settings: { foreground: "#a1a1a1", fontStyle: "italic" },
	},
	{
		scope: [
			"markup.list",
			"punctuation.definition.list.begin",
			"punctuation.definition.list_item",
		],
		settings: { foreground: "#ff9300" },
	},
	{
		scope: ["markup.underline.link", "meta.link.inline", "string.other.link"],
		settings: { foreground: "#47a8ff", fontStyle: "underline" },
	},
	{
		scope: [
			"meta.link.reference",
			"string.other.link.title",
			"string.other.link.description",
		],
		settings: { foreground: "#c472fb" },
	},
	{
		scope: ["meta.separator", "markup.hr"],
		settings: { foreground: "#a1a1a1" },
	},
];

export const diffkitLight: ThemeRegistrationRaw = {
	name: "diffkit-light",
	type: "light",
	settings: diffkitLightTokens as ThemeRegistrationRaw["settings"],
	colors: {
		"editor.background": "#ffffff",
		"editor.foreground": "#171717",
	},
	tokenColors: diffkitLightTokens,
};

export const diffkitDark: ThemeRegistrationRaw = {
	name: "diffkit-dark",
	type: "dark",
	settings: diffkitDarkTokens as ThemeRegistrationRaw["settings"],
	colors: {
		"editor.background": "#1a1a1a",
		"editor.foreground": "#ededed",
	},
	tokenColors: diffkitDarkTokens,
};
