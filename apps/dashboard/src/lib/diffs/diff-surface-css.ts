import { SYNTAX_TOKEN_DECLARATIONS } from "./syntax-tokens";

/** Sizes the virtualizer estimates with; keep them equal to the CSS below. */
export const DIFF_LINE_HEIGHT = 20;
export const DIFF_HUNK_SEPARATOR_HEIGHT = 26;
export const DIFF_SPACING = 4;

/**
 * The diff sits flat on the pane (no card): changed lines carry an edge bar
 * and a row tint, numbers stay neutral, skipped context is a dashed fold line
 * and the empty side of a split is hatched.
 */
export const DIFF_SURFACE_CSS = `
:host {
	${SYNTAX_TOKEN_DECLARATIONS}
	--diffs-font-family: 'Geist Mono Variable', 'SF Mono', ui-monospace, 'Cascadia Code', monospace;
	--diffs-header-font-family: 'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif;
	--diffs-light-bg: var(--ln-main);
	--diffs-dark-bg: var(--ln-main);
	--diffs-light: var(--ln-text);
	--diffs-dark: var(--ln-text-header);
	font-weight: 400;
	--diffs-font-features: "liga" 0, "calt" 0;
	--diffs-font-size: 12px;
	--diffs-line-height: ${DIFF_LINE_HEIGHT}px;
	--diffs-gap-block: ${DIFF_SPACING}px;
	--diffs-gap-inline: 0px;
	--diffs-gap-style: 0 solid transparent;
	--diffs-fg-number-addition-override: var(--ln-text-muted);
	--diffs-fg-number-deletion-override: var(--ln-text-muted);
	--diffs-bg-separator-override: var(--ln-main);
	--diffs-bg-buffer-override: light-dark(var(--ln-gap), color-mix(in oklab, var(--ln-gap) 45%, var(--ln-main)));
	--diffs-bg-hover-override: var(--ln-text-muted);
	--diffs-bg-context-override: var(--ln-main);
	--diffs-bg-selection-override: var(--ln-text-muted);
	--diffs-bg-selection-number-override: var(--ln-text-muted);
}
[data-column-number] {
	box-sizing: border-box;
	min-width: 52px;
	padding: 0 12px 0 0;
}
[data-line-number-content] { min-width: 0; }
[data-gutter-buffer][data-selected-line],
[data-column-number][data-selected-line] { color: var(--ln-text); }
[data-line], [data-no-newline] { padding-inline: 8px 16px; }
[data-indicators='bars'] [data-column-number][data-line-type]:before {
	width: 3px;
	border-radius: 0 2px 2px 0;
}
[data-indicators='bars'] [data-column-number][data-line-type='change-deletion']:before {
	background-image: none;
	background-color: var(--diffs-deletion-base);
}
[data-diff-type='split'] [data-deletions] { border-right: 0; }
[data-diff-type='split'][data-overflow='scroll'] [data-additions],
[data-diff-type='split'][data-overflow='wrap'] [data-additions] [data-gutter] {
	border-left: 1px solid var(--ln-header-rule);
}
[data-gutter-utility-slot] { align-items: center; }
[data-utility-button] {
	width: 18px;
	height: 18px;
	margin-right: -7px;
	border-radius: 6px;
	background-color: var(--ln-accent);
	color: var(--ln-accent-text);
	box-shadow: var(--glass-solid);
}
[data-utility-button]:hover { filter: brightness(1.08); }
[data-utility-button] svg { width: 12px; height: 12px; }
[data-diff] { position: relative; }
[data-diff]:after {
	content: '';
	position: absolute;
	inset: auto 0 0;
	z-index: 4;
	height: 0.5px;
	background-color: var(--diff-file-end-rule, transparent);
	pointer-events: none;
}
[data-gutter-buffer='buffer'] { --diffs-line-bg: var(--ln-main); }
[data-separator='line-info'] {
	height: ${DIFF_HUNK_SEPARATOR_HEIGHT}px;
	background: var(--ln-main)
		repeating-linear-gradient(90deg, var(--ln-chip-border) 0 4px, transparent 4px 8px)
		center / 100% 1px no-repeat;
}
[data-separator-wrapper],
[data-separator-content],
[data-expand-button] {
	background-color: transparent;
	border: 0;
	border-radius: 0;
}
[data-separator-content] {
	justify-content: flex-start;
	padding-inline: var(--diffs-column-number-width, 52px) 0;
}
[data-unmodified-lines] {
	padding-inline: 8px;
	background-color: var(--ln-main);
	font-family: var(--diffs-font-family);
	font-size: 11px;
	font-weight: 450;
	color: var(--ln-text-muted);
}
[data-expand-button] { background-color: var(--ln-main); color: var(--ln-text-muted); }
[data-expand-button]:hover { color: var(--ln-text); }
[data-line-annotation] {
	font-family: var(--diffs-header-font-family);
	font-weight: 450;
	white-space: normal;
}
[data-line-annotation] code { font-family: var(--diffs-font-family, var(--diffs-font-fallback)); }
[data-annotation-content] {
	background-color: transparent;
	position: sticky;
	left: var(--diffs-column-number-width, 52px);
	width: var(--diffs-column-content-width, auto);
	box-sizing: border-box;
}
[data-overflow='wrap'] [data-annotation-content] { position: static; width: auto; }
[data-line-annotation], [data-gutter-buffer='annotation'] { --diffs-line-bg: var(--ln-main); }
`;
