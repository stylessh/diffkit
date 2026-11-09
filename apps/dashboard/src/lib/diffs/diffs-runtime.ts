import { quickhubDark, quickhubLight } from "@diffkit/ui/lib/diffs-themes";
import { shikiBundledLangSet } from "@diffkit/ui/lib/shiki-bundle";
import {
	canUseWASM,
	EXTENSION_TO_FILE_FORMAT,
	type HighlighterTypes,
	preloadHighlighter,
	registerCustomTheme,
	replaceCustomExtensions,
	type SupportedLanguages,
	type ThemesType,
} from "@pierre/diffs";
import {
	getOrCreateWorkerPoolSingleton,
	type WorkerPoolManager,
} from "@pierre/diffs/worker";
import DiffsWorkerUrl from "@pierre/diffs/worker/worker-portable.js?url";
import { cssVariables } from "@pierre/highlights/themes";

const CSS_VARIABLES_THEME = "diffkit-syntax";
const MAIN_THREAD_MAX_CHARACTERS = 100_000;
const PRELOADED_LANGUAGES: SupportedLanguages[] = [
	"typescript",
	"tsx",
	"javascript",
	"css",
	"json",
	"markdown",
];

export type DiffsRuntime = {
	highlighter: HighlighterTypes;
	themes: ThemesType;
	pool: WorkerPoolManager;
};

function isConstrainedDevice() {
	return (
		navigator.maxTouchPoints > 0 &&
		window.matchMedia("(max-width: 767px), (pointer: coarse)").matches
	);
}

/** Shiki throws on grammars outside our trimmed bundle; plain text is the graceful fallback. */
function routeUnbundledExtensionsToText() {
	const overrides: Record<string, SupportedLanguages> = {};
	for (const [extension, lang] of Object.entries(EXTENSION_TO_FILE_FORMAT)) {
		if (!lang || lang === "text" || lang === "ansi") continue;
		if (!shikiBundledLangSet.has(lang)) overrides[extension] = "text";
	}
	replaceCustomExtensions(1, overrides);
}

function createRuntime(): DiffsRuntime {
	const highlighter: HighlighterTypes = canUseWASM()
		? "highlights"
		: "shiki-js";
	let themes: ThemesType;
	if (highlighter === "highlights") {
		registerCustomTheme(
			CSS_VARIABLES_THEME,
			() => Promise.resolve(cssVariables),
			"zed",
		);
		themes = { light: CSS_VARIABLES_THEME, dark: CSS_VARIABLES_THEME };
	} else {
		registerCustomTheme("quickhub-light", () => Promise.resolve(quickhubLight));
		registerCustomTheme("quickhub-dark", () => Promise.resolve(quickhubDark));
		routeUnbundledExtensionsToText();
		themes = { light: "quickhub-light", dark: "quickhub-dark" };
	}

	const constrained = isConstrainedDevice();
	const pool = getOrCreateWorkerPoolSingleton({
		poolOptions: {
			workerFactory: () => new Worker(DiffsWorkerUrl, { type: "module" }),
			poolSize: constrained
				? 1
				: Math.min(Math.max(1, navigator.hardwareConcurrency - 1), 3),
			totalASTLRUCacheSize: constrained ? 10 : 100,
			mainThreadMaxCharacters:
				highlighter === "highlights" ? MAIN_THREAD_MAX_CHARACTERS : undefined,
		},
		highlighterOptions: {
			theme: themes,
			preferredHighlighter: highlighter,
			langs: PRELOADED_LANGUAGES,
			lineDiffType: "word",
			maxLineDiffLength: 1_000,
		},
	});

	void preloadHighlighter({
		themes: [themes.light, themes.dark],
		langs: PRELOADED_LANGUAGES,
		preferredHighlighter: highlighter,
	});

	return { highlighter, themes, pool };
}

let runtime: DiffsRuntime | undefined;

export function getDiffsRuntime(): DiffsRuntime {
	runtime ??= createRuntime();
	return runtime;
}
