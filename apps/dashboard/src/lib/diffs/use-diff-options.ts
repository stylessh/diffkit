import { useTheme } from "next-themes";
import { useMemo } from "react";
import { DIFF_SURFACE_CSS } from "./diff-surface-css";
import { getDiffsRuntime } from "./diffs-runtime";

export type DiffStyle = "unified" | "split";

/** The app's highlighter and syntax palette, for any Pierre component. */
export function useDiffTheme() {
	const runtime = getDiffsRuntime();
	const { resolvedTheme } = useTheme();
	const themeType = resolvedTheme === "dark" ? "dark" : "light";
	return useMemo(
		() =>
			({
				theme: runtime.themes,
				preferredHighlighter: runtime.highlighter,
				themeType,
			}) as const,
		[runtime, themeType],
	);
}

/** What every file diff surface (review, commit, compare) renders with. */
export function useDiffSurfaceOptions({
	diffStyle,
	wrapLines,
}: {
	diffStyle: DiffStyle;
	wrapLines: boolean;
}) {
	const theme = useDiffTheme();
	return useMemo(
		() =>
			({
				...theme,
				diffStyle,
				overflow: wrapLines ? "wrap" : "scroll",
				diffIndicators: "bars",
				hunkSeparators: "line-info",
				unsafeCSS: DIFF_SURFACE_CSS,
			}) as const,
		[theme, diffStyle, wrapLines],
	);
}
