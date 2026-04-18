import type { ThemeRegistrationRaw } from "shiki";

// ---------------------------------------------------------------------------
// QuickHub custom themes for @pierre/diffs
//
// These map our design tokens to shiki's VS Code color model, which the diffs
// library reads to derive all its CSS variables (--diffs-bg, --diffs-fg,
// addition/deletion colors, etc.).
//
// The `colors` object drives the diff chrome; `tokenColors` drives syntax
// highlighting. We reuse the same token palette as shiki-themes.ts (diffkit
// light/dark) but pair it with our own editor/UI chrome colors so the
// diff viewer feels native to the app.
// ---------------------------------------------------------------------------

// ---- Shared token palettes ------------------------------------------------

const lightTokenColors: ThemeRegistrationRaw["tokenColors"] = [
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

const darkTokenColors: ThemeRegistrationRaw["tokenColors"] = [
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

// ---- Theme definitions ----------------------------------------------------

// Light theme: oklch(1 0 0) = #ffffff, oklch(0.967 ...) ≈ #f4f4f5
// surface-0 light = oklch(0.967 0.001 286.375) ≈ #f4f4f5
// border light = oklch(0.92 0.004 286.32) ≈ #e8e8ea
// muted-fg light = oklch(0.552 0.016 285.938) ≈ #71717a

export const quickhubLight: ThemeRegistrationRaw = {
	name: "quickhub-light",
	type: "light",
	settings: lightTokenColors as ThemeRegistrationRaw["settings"],
	tokenColors: lightTokenColors,
	colors: {
		// Editor chrome — matches our surface/background tokens
		"editor.background": "#f4f4f5", // surface-0 light
		"editor.foreground": "#171717", // foreground light
		foreground: "#171717",

		// Selection — subtle blue-gray tint
		"selection.background": "#e4e4e7", // surface-2 ish
		"editor.selectionBackground": "#e4e4e780",
		"editor.lineHighlightBackground": "#e4e4e74d",

		// Line numbers
		"editorLineNumber.foreground": "#a1a1aa", // zinc-400
		"editorLineNumber.activeForeground": "#71717a", // muted-fg

		// Indent guides
		"editorIndentGuide.background": "#e4e4e7",
		"editorIndentGuide.activeBackground": "#d4d4d8",

		// Diff colors — green/red that feel at home
		"diffEditor.insertedTextBackground": "#10b98120",
		"diffEditor.deletedTextBackground": "#ef444420",
		"gitDecoration.addedResourceForeground": "#10b981",
		"gitDecoration.deletedResourceForeground": "#ef4444",
		"gitDecoration.modifiedResourceForeground": "#3b82f6",

		// Sidebar/panel — surface-1
		"sideBar.background": "#ebebec",
		"sideBar.foreground": "#71717a",
		"sideBar.border": "#e8e8ea",
		"panel.background": "#ebebec",
		"panel.border": "#e8e8ea",

		// Input
		"input.background": "#f4f4f5",
		"input.border": "#e4e4e7",
		"input.foreground": "#171717",
		"input.placeholderForeground": "#a1a1aa",

		// Terminal ANSI
		"terminal.ansiBlack": "#171717",
		"terminal.ansiRed": "#ef4444",
		"terminal.ansiGreen": "#10b981",
		"terminal.ansiYellow": "#f59e0b",
		"terminal.ansiBlue": "#3b82f6",
		"terminal.ansiMagenta": "#a855f7",
		"terminal.ansiCyan": "#06b6d4",
		"terminal.ansiWhite": "#d4d4d8",
		"terminal.ansiBrightBlack": "#52525b",
		"terminal.ansiBrightRed": "#f87171",
		"terminal.ansiBrightGreen": "#34d399",
		"terminal.ansiBrightYellow": "#fbbf24",
		"terminal.ansiBrightBlue": "#60a5fa",
		"terminal.ansiBrightMagenta": "#c084fc",
		"terminal.ansiBrightCyan": "#22d3ee",
		"terminal.ansiBrightWhite": "#fafafa",
	},
};

// Dark theme: oklch(0.141 ...) = #1a1a1a-ish, oklch(0.21 ...) ≈ #2a2a2d
// surface-0 dark = oklch(0.21 0.006 286.033) ≈ #2a2a2d
// border dark = oklch(0.274 0.006 286.033) ≈ #3a3a3d
// muted-fg dark = oklch(0.705 0.015 286.067) ≈ #a1a1ab

export const quickhubDark: ThemeRegistrationRaw = {
	name: "quickhub-dark",
	type: "dark",
	settings: darkTokenColors as ThemeRegistrationRaw["settings"],
	tokenColors: darkTokenColors,
	colors: {
		// Editor chrome — matches our surface/background tokens
		"editor.background": "#1a1a1c", // background dark
		"editor.foreground": "#fafafa", // foreground dark
		foreground: "#fafafa",

		// Selection
		"selection.background": "#3a3a3d",
		"editor.selectionBackground": "#3a3a3d80",
		"editor.lineHighlightBackground": "#3a3a3d4d",

		// Line numbers
		"editorLineNumber.foreground": "#52525b", // zinc-600
		"editorLineNumber.activeForeground": "#a1a1ab", // muted-fg

		// Indent guides
		"editorIndentGuide.background": "#2a2a2d",
		"editorIndentGuide.activeBackground": "#3a3a3d",

		// Diff colors
		"diffEditor.insertedTextBackground": "#10b98118",
		"diffEditor.deletedTextBackground": "#ef444418",
		"gitDecoration.addedResourceForeground": "#34d399",
		"gitDecoration.deletedResourceForeground": "#f87171",
		"gitDecoration.modifiedResourceForeground": "#60a5fa",

		// Sidebar/panel — surface-1
		"sideBar.background": "#27272a",
		"sideBar.foreground": "#a1a1ab",
		"sideBar.border": "#3a3a3d",
		"panel.background": "#27272a",
		"panel.border": "#3a3a3d",

		// Input
		"input.background": "#27272a",
		"input.border": "#3a3a3d",
		"input.foreground": "#fafafa",
		"input.placeholderForeground": "#71717a",

		// Terminal ANSI
		"terminal.ansiBlack": "#27272a",
		"terminal.ansiRed": "#f87171",
		"terminal.ansiGreen": "#34d399",
		"terminal.ansiYellow": "#fbbf24",
		"terminal.ansiBlue": "#60a5fa",
		"terminal.ansiMagenta": "#c084fc",
		"terminal.ansiCyan": "#22d3ee",
		"terminal.ansiWhite": "#d4d4d8",
		"terminal.ansiBrightBlack": "#52525b",
		"terminal.ansiBrightRed": "#fca5a5",
		"terminal.ansiBrightGreen": "#6ee7b7",
		"terminal.ansiBrightYellow": "#fde68a",
		"terminal.ansiBrightBlue": "#93c5fd",
		"terminal.ansiBrightMagenta": "#d8b4fe",
		"terminal.ansiBrightCyan": "#67e8f9",
		"terminal.ansiBrightWhite": "#fafafa",
	},
};
