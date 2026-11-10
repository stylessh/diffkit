import { PatchDiff, type PatchDiffProps } from "@pierre/diffs/react";
import { useMemo } from "react";
import { SYNTAX_TOKEN_DECLARATIONS } from "#/lib/diffs/syntax-tokens";
import { useDiffTheme } from "#/lib/diffs/use-diff-options";

/** A single patch (review comment hunks) on the app's highlighter and syntax palette. */
export function DiffPatch<LAnnotation>({
	options,
	...props
}: PatchDiffProps<LAnnotation, undefined>) {
	const theme = useDiffTheme();
	const themed = useMemo(
		() => ({
			...options,
			...theme,
			unsafeCSS: `:host { ${SYNTAX_TOKEN_DECLARATIONS} }\n${options?.unsafeCSS ?? ""}`,
		}),
		[options, theme],
	);
	return <PatchDiff {...props} options={themed} disableWorkerPool />;
}
