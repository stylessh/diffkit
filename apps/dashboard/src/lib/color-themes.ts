import { useSyncExternalStore } from "react";

export type ColorScheme = "light" | "dark";

/** The colours a theme card draws its miniature with. */
export type ThemeSwatches = {
	shell: string;
	main: string;
	row: string;
	text: string;
	accent: string;
};

export type ColorTheme = {
	id: string;
	label: string;
	description: string;
	swatches: Record<ColorScheme, ThemeSwatches>;
};

const PRIMARY = "lch(50.84 48.54 140.93)";

/** Swatches sampled from the neutral scale in globals.css at a given hue and tint. */
function scaleSwatches(
	hue: number,
	tint: number,
): Record<ColorScheme, ThemeSwatches> {
	const tone = (lightness: number, chroma: number) =>
		`oklch(${lightness} ${chroma * tint} ${hue})`;
	return {
		light: {
			shell: tone(0.94, 0.004),
			main: tone(0.985, 0.002),
			row: tone(0.92, 0.005),
			text: tone(0.6, 0.016),
			accent: PRIMARY,
		},
		dark: {
			shell: tone(0.14, 0.006),
			main: tone(0.185, 0.008),
			row: tone(0.26, 0.011),
			text: tone(0.55, 0.02),
			accent: PRIMARY,
		},
	};
}

export const COLOR_THEMES = [
	{
		id: "diffkit",
		label: "DiffKit",
		description: "Slate",
		swatches: scaleSwatches(235, 1),
	},
	{
		id: "tide",
		label: "Tide",
		description: "Teal",
		swatches: scaleSwatches(195, 1),
	},
	{
		id: "graphite",
		label: "Graphite",
		description: "Neutral",
		swatches: scaleSwatches(235, 0),
	},
	{
		id: "paper",
		label: "Paper",
		description: "Warm grey",
		swatches: scaleSwatches(75, 1.4),
	},
	{
		id: "linear",
		label: "Linear",
		description: "Indigo",
		swatches: {
			light: {
				shell: "lch(94 0.51 287.19)",
				main: "lch(98 0.5 287.27)",
				row: "lch(91 0.5 287)",
				text: "lch(52 1.25 282)",
				accent: "lch(47.6 59.33 288.74)",
			},
			dark: {
				shell: "lch(2.6 0.5 272)",
				main: "lch(6 0.6 272)",
				row: "lch(16.7 1 272)",
				text: "lch(45 1.2 272)",
				accent: "lch(47.6 59.33 288.74)",
			},
		},
	},
] as const satisfies readonly ColorTheme[];

export type ColorThemeId = (typeof COLOR_THEMES)[number]["id"];

export const DEFAULT_COLOR_THEME: ColorThemeId = "diffkit";

const THEME_IDS: readonly string[] = COLOR_THEMES.map((theme) => theme.id);

export function parseColorThemeId(raw: string | null): ColorThemeId {
	return raw && THEME_IDS.includes(raw)
		? (raw as ColorThemeId)
		: DEFAULT_COLOR_THEME;
}

const STORAGE_KEY: Record<ColorScheme, string> = {
	light: "diffkit:color-theme:light",
	dark: "diffkit:color-theme:dark",
};

const ATTRIBUTE: Record<ColorScheme, string> = {
	light: "data-light-theme",
	dark: "data-dark-theme",
};

/**
 * Runs in <head> before first paint, so a saved theme never flashes the
 * default. It only copies known ids onto <html>; React owns it afterwards.
 */
export const COLOR_THEME_BOOT_SCRIPT = `(function(){try{var ids=${JSON.stringify(THEME_IDS)};var map=${JSON.stringify(
	(["light", "dark"] as const).map((scheme) => [
		STORAGE_KEY[scheme],
		ATTRIBUTE[scheme],
	]),
)};for(var i=0;i<map.length;i++){var v=localStorage.getItem(map[i][0]);if(v&&ids.indexOf(v)>-1)document.documentElement.setAttribute(map[i][1],v);}}catch(e){}})();`;

const snapshots = new Map<ColorScheme, ColorThemeId>();
const listeners = new Set<() => void>();

function readSnapshot(scheme: ColorScheme) {
	const cached = snapshots.get(scheme);
	if (cached) return cached;
	let raw: string | null = null;
	try {
		raw = window.localStorage.getItem(STORAGE_KEY[scheme]);
	} catch {}
	const next = parseColorThemeId(raw);
	snapshots.set(scheme, next);
	return next;
}

function applyToDocument(scheme: ColorScheme, id: ColorThemeId) {
	document.documentElement.setAttribute(ATTRIBUTE[scheme], id);
}

function handleStorageEvent(event: StorageEvent) {
	const scheme = (["light", "dark"] as const).find(
		(candidate) => STORAGE_KEY[candidate] === event.key,
	);
	if (!scheme) return;
	snapshots.delete(scheme);
	applyToDocument(scheme, readSnapshot(scheme));
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	if (listeners.size === 1) {
		window.addEventListener("storage", handleStorageEvent);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			window.removeEventListener("storage", handleStorageEvent);
		}
	};
}

export function setColorTheme(scheme: ColorScheme, id: ColorThemeId) {
	try {
		window.localStorage.setItem(STORAGE_KEY[scheme], id);
	} catch {}
	snapshots.set(scheme, id);
	applyToDocument(scheme, id);
	for (const listener of listeners) listener();
}

/** The theme picked for one scheme on this device; the default until hydrated. */
export function useColorTheme(scheme: ColorScheme): ColorThemeId {
	return useSyncExternalStore(
		subscribe,
		() => readSnapshot(scheme),
		() => DEFAULT_COLOR_THEME,
	);
}
