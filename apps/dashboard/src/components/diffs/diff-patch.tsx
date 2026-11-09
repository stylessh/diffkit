import { PatchDiff, type PatchDiffProps } from "@pierre/diffs/react";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { getDiffsRuntime } from "#/lib/diffs/diffs-runtime";
import { SYNTAX_TOKEN_DECLARATIONS } from "#/lib/diffs/syntax-tokens";

/** A single patch (review comment hunks) on the app's highlighter and syntax palette. */
export function DiffPatch<LAnnotation>({
	options,
	...props
}: PatchDiffProps<LAnnotation, undefined>) {
	const runtime = getDiffsRuntime();
	const { resolvedTheme } = useTheme();
	const themed = useMemo(
		() => ({
			...options,
			theme: runtime.themes,
			preferredHighlighter: runtime.highlighter,
			themeType:
				resolvedTheme === "dark" ? ("dark" as const) : ("light" as const),
			unsafeCSS: `:host { ${SYNTAX_TOKEN_DECLARATIONS} }\n${options?.unsafeCSS ?? ""}`,
		}),
		[options, runtime, resolvedTheme],
	);
	return <PatchDiff {...props} options={themed} disableWorkerPool />;
}
