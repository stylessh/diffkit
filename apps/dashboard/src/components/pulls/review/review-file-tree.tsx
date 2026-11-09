import type {
	FileTree as FileTreeModel,
	FileTreeRowDecorationRenderer,
	GitStatus,
	GitStatusEntry,
} from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import { memo, useEffect, useRef } from "react";
import {
	TREE_ICONS,
	TREE_UNSAFE_CSS,
} from "#/components/shared/pierre-file-tree";
import type { PullFileSummary } from "#/lib/github.types";

/**
 * Lightweight store so the active file can change on every scroll tick
 * without re-rendering the page that owns it.
 */
export type ActiveFileStore = {
	get: () => string | null;
	set: (file: string | null) => void;
	subscribe: (listener: () => void) => () => void;
};

export function createActiveFileStore(
	initial: string | null = null,
): ActiveFileStore {
	let value = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => value,
		set: (v) => {
			if (v === value) return;
			value = v;
			for (const l of listeners) l();
		},
		subscribe: (l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
	};
}

export type ReviewTreeFile = Pick<
	PullFileSummary,
	"filename" | "status" | "additions" | "deletions"
>;

const ROW_HEIGHT = 29;

const GIT_STATUS: Partial<Record<ReviewTreeFile["status"], GitStatus>> = {
	added: "added",
	copied: "added",
	removed: "deleted",
	renamed: "renamed",
	modified: "modified",
	changed: "modified",
};

function gitStatusEntries(files: readonly ReviewTreeFile[]): GitStatusEntry[] {
	const entries: GitStatusEntry[] = [];
	for (const file of files) {
		const status = GIT_STATUS[file.status];
		if (status) entries.push({ path: file.filename, status });
	}
	return entries;
}

function isSameFile(a: ReviewTreeFile, b: ReviewTreeFile) {
	return (
		a.filename === b.filename &&
		a.status === b.status &&
		a.additions === b.additions &&
		a.deletions === b.deletions
	);
}

/** True when `next` only appends files to `previous` (summaries streaming in). */
function extendsFiles(
	previous: readonly ReviewTreeFile[],
	next: readonly ReviewTreeFile[],
) {
	if (next.length < previous.length) return false;
	for (let index = 0; index < previous.length; index++) {
		if (!isSameFile(previous[index], next[index])) return false;
	}
	return true;
}

function syncTree(
	model: FileTreeModel,
	previous: readonly ReviewTreeFile[],
	next: readonly ReviewTreeFile[],
) {
	if (extendsFiles(previous, next)) {
		const added = next.slice(previous.length);
		if (added.length === 0) return;
		model.batch(added.map((file) => ({ type: "add", path: file.filename })));
		model.applyGitStatusPatch({ set: gitStatusEntries(added) });
		return;
	}
	model.resetPaths(next.map((file) => file.filename));
	model.setGitStatus(gitStatusEntries(next));
}

function lineCounts(file: ReviewTreeFile | undefined) {
	if (!file) return null;
	const parts = [
		file.additions > 0 ? `+${file.additions}` : null,
		file.deletions > 0 ? `-${file.deletions}` : null,
	].filter((part) => part !== null);
	return parts.length > 0 ? { text: parts.join(" ") } : null;
}

/**
 * The changed files of a PR or commit, in a virtualized `@pierre/trees` tree.
 * The highlighted row follows `activeFileStore`; picking a file calls
 * `onFileClick` with its path.
 */
export const ReviewFileTree = memo(function ReviewFileTree({
	files,
	activeFileStore,
	onFileClick,
}: {
	files: readonly ReviewTreeFile[];
	activeFileStore: ActiveFileStore;
	onFileClick: (path: string) => void;
}) {
	const syncedFilesRef = useRef(files);
	const filesByPathRef = useRef(
		new Map(files.map((file) => [file.filename, file])),
	);
	const onFileClickRef = useRef(onFileClick);
	onFileClickRef.current = onFileClick;
	const modelRef = useRef<FileTreeModel | null>(null);

	const renderRowDecoration: FileTreeRowDecorationRenderer = ({ item }) =>
		item.kind === "file"
			? lineCounts(filesByPathRef.current.get(item.path))
			: null;

	const showActiveFile = () => {
		const model = modelRef.current;
		if (!model) return;
		const active = activeFileStore.get();
		for (const path of model.getSelectedPaths()) {
			if (path !== active) model.getItem(path)?.deselect();
		}
		if (active) model.getItem(active)?.select();
	};

	const initialActiveFile = activeFileStore.get();
	const { model } = useFileTree({
		paths: files.map((file) => file.filename),
		gitStatus: gitStatusEntries(files),
		initialExpansion: "open",
		flattenEmptyDirectories: true,
		initialSelectedPaths: initialActiveFile ? [initialActiveFile] : [],
		itemHeight: ROW_HEIGHT,
		icons: TREE_ICONS,
		unsafeCSS: TREE_UNSAFE_CSS,
		renderRowDecoration,
		onSelectionChange: (paths) => {
			if (paths.length !== 1) return;
			const [path] = paths;
			if (path === activeFileStore.get()) return;
			if (path.endsWith("/")) {
				// A folder click toggles it; the highlight stays on the active file.
				queueMicrotask(showActiveFile);
				return;
			}
			onFileClickRef.current(path);
		},
	});
	modelRef.current = model;

	// biome-ignore lint/correctness/useExhaustiveDependencies: showActiveFile reads the model through a ref
	useEffect(() => {
		if (syncedFilesRef.current === files) return;
		filesByPathRef.current = new Map(
			files.map((file) => [file.filename, file]),
		);
		syncTree(model, syncedFilesRef.current, files);
		syncedFilesRef.current = files;
		showActiveFile();
	}, [files, model]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: showActiveFile reads the model through a ref
	useEffect(() => {
		showActiveFile();
		return activeFileStore.subscribe(showActiveFile);
	}, [activeFileStore, model]);

	return (
		<FileTree
			model={model}
			data-tree="review"
			aria-label="Changed files"
			className="min-h-0 flex-1 pt-1"
		/>
	);
});
