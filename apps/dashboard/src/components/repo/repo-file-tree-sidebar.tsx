import type {
	FileTreeBatchOperation,
	FileTree as FileTreeModel,
	FileTreeRowDecorationRenderer,
} from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { memo, type ReactNode, useEffect, useRef } from "react";
import { Skeleton, SkeletonBox } from "skullet/react";
import {
	refreshTreeRows,
	TREE_ICONS,
	TREE_ROW_HEIGHT,
	TREE_UNSAFE_CSS,
	treeRowPathFromEvent,
} from "#/components/shared/pierre-file-tree";
import {
	getExplorerPath,
	subscribeExplorerPath,
} from "#/lib/explorer-path-store";
import { SAMPLE_TREE_ENTRIES } from "./repo-samples";
import {
	type ExplorerContext,
	type ExplorerDirectories,
	useExplorerDirectories,
} from "./use-explorer-directories";

export const RepoFileTreeSidebar = memo(function RepoFileTreeSidebar(
	context: ExplorerContext,
) {
	return (
		<div className="flex h-full flex-col overflow-hidden">
			<div className="flex h-11 shrink-0 items-center border-b-[0.5px] border-header-rule px-4 text-xs font-medium text-muted-foreground">
				Files
			</div>
			<nav aria-label="Files" className="flex min-h-0 flex-1 flex-col pt-2">
				<ExplorerTree
					key={`${context.owner}/${context.repoName}@${context.currentRef}`}
					context={context}
				/>
			</nav>
		</div>
	);
});

function ExplorerTree({ context }: { context: ExplorerContext }) {
	const directories = useExplorerDirectories(context);
	const root = directories.listing("");
	switch (root?.status) {
		case undefined:
		case "loading":
			return <ExplorerTreeSkeleton />;
		case "error":
		case "missing":
			return <TreeStatusRow>Couldn't load files</TreeStatusRow>;
		case "ready":
			return <ExplorerFileTree context={context} directories={directories} />;
	}
}

function TreeStatusRow({ children }: { children: ReactNode }) {
	return (
		<p className="flex h-7 items-center gap-2 pl-9 text-xs text-muted-foreground">
			{children}
		</p>
	);
}

function ExplorerTreeSkeleton() {
	return (
		<Skeleton loading label="Loading files">
			{SAMPLE_TREE_ENTRIES.map((entry) => (
				<div
					key={entry.path}
					className="flex items-center gap-1.5 pl-7 text-[13px] font-[450]"
					style={{ height: TREE_ROW_HEIGHT }}
				>
					<SkeletonBox width={16} height={16} radius={4} className="shrink-0" />
					<span className="truncate">{entry.name}</span>
				</div>
			))}
		</Skeleton>
	);
}

const LOADING_FOLDER_TITLE = "Loading folder";

/**
 * A folder that is still listing shows a skeleton bar in its decoration lane.
 * The tree renders in a shadow root, so the bar is styled here, from the same
 * theme tokens skullet draws with.
 */
const EXPLORER_TREE_CSS = `${TREE_UNSAFE_CSS}
[data-item-section='decoration'] > span[title='${LOADING_FOLDER_TITLE}'] {
	display: block;
	width: 36px;
	height: 8px;
	border-radius: 4px;
	background: var(--skullet-base);
	animation: explorer-folder-loading 1.2s ease-in-out infinite;
}
@keyframes explorer-folder-loading {
	50% { opacity: 0.45; }
}
@media (prefers-reduced-motion: reduce) {
	[data-item-section='decoration'] > span[title='${LOADING_FOLDER_TITLE}'] {
		animation: none;
	}
}
`;

type TreePath = { kind: "file" | "dir"; path: string };

function toTreePath(id: string): TreePath {
	return id.endsWith("/")
		? { kind: "dir", path: id.slice(0, -1) }
		: { kind: "file", path: id };
}

/** Directory ids of `path` and its ancestors, outermost first. */
function revealIds(path: string) {
	const ids: string[] = [];
	const segments = path.split("/").filter(Boolean);
	for (let index = 1; index <= segments.length; index++) {
		ids.push(`${segments.slice(0, index).join("/")}/`);
	}
	return ids;
}

function directoryItem(model: FileTreeModel, id: string) {
	const item = model.getItem(id);
	return item && "expand" in item ? item : null;
}

function itemForPath(model: FileTreeModel, path: string) {
	return model.getItem(path) ?? model.getItem(`${path}/`);
}

function syncPaths(
	model: FileTreeModel,
	previous: readonly string[],
	next: readonly string[],
) {
	const before = new Set(previous);
	const after = new Set(next);
	const operations: FileTreeBatchOperation[] = [];
	for (const path of previous) {
		if (!after.has(path))
			operations.push({ type: "remove", path, recursive: true });
	}
	for (const path of next) {
		if (!before.has(path)) operations.push({ type: "add", path });
	}
	if (operations.length > 0) model.batch(operations);
}

/**
 * Selects the current explorer path and opens the folders down to it. Each
 * folder is opened once per path, so a folder the user closes stays closed.
 */
function revealCurrentPath(model: FileTreeModel, revealed: Set<string>) {
	const current = getExplorerPath();
	for (const id of model.getSelectedPaths()) {
		if (toTreePath(id).path !== current) model.getItem(id)?.deselect();
	}
	for (const id of revealIds(current)) {
		if (revealed.has(id)) continue;
		const item = model.getItem(id);
		if (!item) break;
		revealed.add(id);
		if ("expand" in item) item.expand();
	}
	const active = itemForPath(model, current);
	if (active && !active.isSelected()) active.select();
}

function ExplorerFileTree({
	context,
	directories,
}: {
	context: ExplorerContext;
	directories: ExplorerDirectories;
}) {
	const navigate = useNavigate();
	const router = useRouter();
	const directoriesRef = useRef(directories);
	directoriesRef.current = directories;
	const syncedPathsRef = useRef(directories.paths);
	const revealedRef = useRef(new Set<string>());
	const modelRef = useRef<FileTreeModel | null>(null);

	const routeFor = ({ kind, path }: TreePath) =>
		({
			to: kind === "dir" ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$",
			params: {
				owner: context.owner,
				repo: context.repoName,
				_splat: `${context.currentRef}/${path}`,
			},
		}) as const;

	const renderRowDecoration: FileTreeRowDecorationRenderer = ({ item }) => {
		if (item.kind !== "directory") return null;
		const listing = directoriesRef.current.listing(toTreePath(item.path).path);
		switch (listing?.status) {
			case "loading":
				return { text: "", title: LOADING_FOLDER_TITLE };
			case "error":
				return { text: "Couldn't load" };
			default:
				return null;
		}
	};

	const current = getExplorerPath();
	const { model } = useFileTree({
		paths: directories.paths,
		initialExpansion: "closed",
		initialExpandedPaths: revealIds(current),
		itemHeight: TREE_ROW_HEIGHT,
		icons: TREE_ICONS,
		unsafeCSS: EXPLORER_TREE_CSS,
		renderRowDecoration,
		onSelectionChange: (ids) => {
			if (ids.length !== 1) return;
			const target = toTreePath(ids[0]);
			if (target.path === getExplorerPath()) return;
			void navigate(routeFor(target));
			if (target.kind === "dir") {
				queueMicrotask(() => {
					if (modelRef.current)
						directoryItem(modelRef.current, ids[0])?.expand();
				});
			}
		},
	});
	modelRef.current = model;

	useEffect(() => {
		if (syncedPathsRef.current !== directories.paths) {
			syncPaths(model, syncedPathsRef.current, directories.paths);
			syncedPathsRef.current = directories.paths;
		}
		revealCurrentPath(model, revealedRef.current);
		refreshTreeRows(model);
	}, [directories, model]);

	useEffect(() => {
		let path = getExplorerPath();
		return subscribeExplorerPath(() => {
			if (getExplorerPath() === path) return;
			path = getExplorerPath();
			revealedRef.current = new Set();
			revealCurrentPath(model, revealedRef.current);
		});
	}, [model]);

	// Opening a folder lists it unless the recursive tree already answered it,
	// and reopening one that failed tries again.
	useEffect(() => {
		let expanded = new Set<string>();
		const loadExpanded = () => {
			const nowExpanded = new Set<string>();
			for (const id of syncedPathsRef.current) {
				if (!id.endsWith("/") || !directoryItem(model, id)?.isExpanded()) {
					continue;
				}
				nowExpanded.add(id);
				if (!expanded.has(id)) directoriesRef.current.load(id.slice(0, -1));
			}
			expanded = nowExpanded;
		};
		loadExpanded();
		return model.subscribe(loadExpanded);
	}, [model]);

	const hostRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		// The rows are buttons in a shadow root, so a modified or middle click
		// is turned into the new tab a link would have opened.
		const openInNewTab = (event: MouseEvent) => {
			const opensTab =
				event.type === "auxclick"
					? event.button === 1
					: event.metaKey || event.ctrlKey;
			if (!opensTab) return;
			const id = treeRowPathFromEvent(event);
			if (!id) return;
			event.preventDefault();
			event.stopPropagation();
			const href = router.buildLocation(routeFor(toTreePath(id))).href;
			window.open(href, "_blank", "noopener");
		};
		host.addEventListener("click", openInNewTab, true);
		host.addEventListener("auxclick", openInNewTab, true);
		return () => {
			host.removeEventListener("click", openInNewTab, true);
			host.removeEventListener("auxclick", openInNewTab, true);
		};
	});

	return (
		<div ref={hostRef} className="flex min-h-0 flex-1 flex-col">
			<FileTree model={model} data-tree="explorer" className="min-h-0 flex-1" />
		</div>
	);
}
