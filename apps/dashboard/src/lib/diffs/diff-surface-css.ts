import { SYNTAX_TOKEN_DECLARATIONS } from "./syntax-tokens";

export const DIFF_SURFACE_CSS = `
:host {
	${SYNTAX_TOKEN_DECLARATIONS}
	--diffs-font-family: 'Geist Mono Variable', 'SF Mono', ui-monospace, 'Cascadia Code', monospace;
	--diffs-header-font-family: 'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif;
	--diffs-light-bg: var(--ln-card);
	--diffs-dark-bg: var(--ln-card);
	--diffs-light: var(--ln-text);
	--diffs-dark: var(--ln-text-header);
	font-weight: 400;
	--diffs-font-features: "liga" 0, "calt" 0;
	--diffs-font-size: 12px;
	--diffs-line-height: 20px;
	--diffs-gap-block: 4px;
	--diffs-gap-inline: 0px;
	--diffs-gap-style: 0 solid transparent;
	--diffs-fg-number-addition-override: var(--ln-success);
	--diffs-fg-number-deletion-override: var(--ln-number-removed);
	--diffs-bg-separator-override: var(--ln-card);
	--diffs-bg-hover-override: var(--ln-row-hover);
	--diffs-bg-context-override: var(--ln-main);
}
[data-code] { padding-block: 4px; }
[data-column-number] {
	box-sizing: border-box;
	min-width: 50px;
	padding: 0 12px 0 0;
}
[data-line-number-content] { min-width: 0; }
[data-line], [data-no-newline] { padding-inline: 0 16px; }
[data-diff-type='split'] [data-deletions] { border-right: 0; }
[data-diff-type='split'][data-overflow='scroll'] [data-additions],
[data-diff-type='split'][data-overflow='wrap'] [data-additions] [data-gutter] {
	border-left: 1px solid var(--ln-card-border);
}
[data-gutter-utility-slot] { align-items: center; }
[data-utility-button] {
	width: 20px;
	height: 20px;
	margin-right: -12px;
	border-radius: 9999px;
	background-color: var(--ln-button);
	color: var(--ln-text-muted);
	box-shadow: var(--ln-button-ring);
}
[data-utility-button]:hover { background-color: var(--ln-button-hover); color: var(--ln-text); }
[data-utility-button] svg { width: 12px; height: 12px; }
[data-content-buffer],
[data-gutter-buffer='buffer'] {
	background-image: none;
	background-color: var(--ln-card);
}
[data-separator='line-info'] {
	height: 28px;
	margin-block: 0;
	background-color: var(--ln-card);
}
[data-separator-wrapper],
[data-separator-content],
[data-expand-button] {
	background-color: transparent;
	border: 0;
	border-radius: 0;
}
[data-separator-content] {
	justify-content: center;
	font-size: 12px;
	font-weight: 500;
	color: var(--ln-text-muted);
	padding-inline: 8px;
}
[data-expand-button] { color: var(--ln-text-muted); }
[data-expand-button]:hover { color: var(--ln-text); }
[data-line-annotation] {
	font-family: var(--diffs-header-font-family);
	font-weight: 450;
	white-space: normal;
	border-block: 0.5px solid var(--ln-card-border);
}
[data-gutter-buffer='annotation'] { border-block: 0.5px solid var(--ln-card-border); }
[data-line-annotation] code { font-family: var(--diffs-font-family, var(--diffs-font-fallback)); }
[data-annotation-content] {
	background-color: transparent;
	position: sticky;
	left: var(--diffs-column-number-width, 50px);
	width: var(--diffs-column-content-width, auto);
	box-sizing: border-box;
}
[data-overflow='wrap'] [data-annotation-content] { position: static; width: auto; }
[data-line-annotation], [data-gutter-buffer='annotation'] { --diffs-line-bg: var(--ln-main); }
`;
