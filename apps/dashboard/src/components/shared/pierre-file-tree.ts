import type { FileTree, FileTreeIconConfig } from "@pierre/trees";
import { FILE_ICON_SET } from "#/lib/file-icons";

/**
 * Shared look for every `@pierre/trees` tree. Colours and row states come from
 * the `file-tree-container` block in globals.css (per `data-tree` variant), so
 * theme switches stay pure CSS; this module only carries geometry and glyphs.
 */

export const TREE_ROW_HEIGHT = 28;

const CHEVRON_SYMBOL = "diffkit-tree-chevron";

/** Our sharp-tipped chevron (packages/icons chevron-icons), pointing down. */
const SPRITE_SHEET = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="${CHEVRON_SYMBOL}" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="miter"/></symbol></svg>`;

export const TREE_ICONS: FileTreeIconConfig = {
	set: FILE_ICON_SET,
	colored: true,
	spriteSheet: SPRITE_SHEET,
	remap: {
		"file-tree-icon-chevron": { name: CHEVRON_SYMBOL, width: 12, height: 12 },
	},
};

/** Folder01 from @diffkit/icons (Hugeicons stroke), drawn as a mask. */
const FOLDER_MASK = `url("data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M7 7H16.75C18.8567 7 19.91 7 20.6667 7.50559C20.9943 7.72447 21.2755 8.00572 21.4944 8.33329C22 9.08996 22 10.1433 22 12.25C22 15.7612 22 17.5167 21.1573 18.7779C20.7926 19.3238 20.3238 19.7926 19.7779 20.1573C18.5167 21 16.7612 21 13.25 21H12C7.28595 21 4.92893 21 3.46447 19.5355C2 18.0711 2 15.714 2 11V7.94427C2 6.1278 2 5.21956 2.38032 4.53806C2.65142 4.05227 3.05227 3.65142 3.53806 3.38032C4.21956 3 5.1278 3 6.94427 3C8.10802 3 8.6899 3 9.19926 3.19101C10.3622 3.62712 10.8418 4.68358 11.3666 5.73313L12 7" stroke="black" stroke-linecap="round" stroke-width="1.8"/></svg>',
)}")`;

/**
 * Rows are laid out like the trees they replace: a chevron lane, our
 * folder glyph before folder names, file icons aligned under folder glyphs,
 * 12px per level and no indent guides.
 */
export const TREE_UNSAFE_CSS = `
[data-type='item'] {
	padding: 0 8px 0 6px;
	border-bottom: var(--tree-row-gap, 0px) solid transparent;
	background-clip: padding-box;
	transition: background-color 120ms, color 120ms;
}
[data-type='item']:hover {
	color: var(--tree-hover-fg, inherit);
}
[data-item-section='spacing'] {
	padding-left: 0;
	margin-inline-end: calc(-1 * var(--trees-item-row-gap));
}
[data-item-section='spacing-item'] {
	width: 12px;
	margin: 0;
	border: 0;
}
[data-item-section='spacing-item'] + [data-item-section='spacing-item'] {
	margin-left: 0;
}
[data-item-type='folder'] > [data-item-section='icon'] {
	width: var(--tree-chevron-lane, 12px);
	color: var(--tree-chevron-fg, currentColor);
}
[data-item-type='file'] > [data-item-section='icon'] {
	width: var(--tree-file-icon-size, 16px);
	margin-inline-start: calc(var(--tree-chevron-lane, 12px) + 6px);
}
[data-item-type='file'] > [data-item-section='icon'] svg {
	width: var(--tree-file-icon-size, 16px);
	height: var(--tree-file-icon-size, 16px);
}
[data-item-type='folder'] > [data-item-section='content'] {
	display: flex;
	align-items: center;
}
[data-item-type='folder'] > [data-item-section='content'] > * {
	min-width: 0;
}
[data-item-type='folder'] > [data-item-section='content']::before {
	content: '';
	flex: none;
	width: var(--tree-file-icon-size, 16px);
	height: var(--tree-file-icon-size, 16px);
	margin-inline-end: 6px;
	background-color: var(--tree-folder-fg, currentColor);
	mask: ${FOLDER_MASK} center / contain no-repeat;
}
[data-item-flattened-subitems] {
	gap: 0;
}
[data-item-section='decoration'] {
	padding-left: 8px;
	font-size: 11px;
	font-weight: 450;
	font-variant-numeric: tabular-nums;
}
[data-item-contains-git-change='true'] > [data-item-section='git'],
[data-item-section='git'] {
	display: none;
}
[data-item-git-status='deleted'] > [data-item-section='content'] {
	text-decoration: line-through;
}
`;

/**
 * Re-renders visible rows so `renderRowDecoration` sees state the model does
 * not own (e.g. a directory that started or failed loading).
 */
export function refreshTreeRows(model: FileTree) {
	model.setComposition(model.getComposition());
}

/** The row path under a pointer event that crossed the tree's shadow root. */
export function treeRowPathFromEvent(event: Event): string | null {
	for (const target of event.composedPath()) {
		if (target instanceof HTMLElement && target.dataset.type === "item") {
			return target.dataset.itemPath ?? null;
		}
	}
	return null;
}
