import type { ThemeRegistrationRaw } from "shiki";

const vercelLightTokens: ThemeRegistrationRaw["tokenColors"] = [
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
];

const vercelDarkTokens: ThemeRegistrationRaw["tokenColors"] = [
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
];

export const vercelLight: ThemeRegistrationRaw = {
	name: "vercel-light",
	type: "light",
	settings: vercelLightTokens as ThemeRegistrationRaw["settings"],
	colors: {
		"editor.background": "#ffffff",
		"editor.foreground": "#171717",
	},
	tokenColors: vercelLightTokens,
};

export const vercelDark: ThemeRegistrationRaw = {
	name: "vercel-dark",
	type: "dark",
	settings: vercelDarkTokens as ThemeRegistrationRaw["settings"],
	colors: {
		"editor.background": "#1a1a1a",
		"editor.foreground": "#ededed",
	},
	tokenColors: vercelDarkTokens,
};
