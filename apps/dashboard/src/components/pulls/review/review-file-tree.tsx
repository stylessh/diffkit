import { FolderIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	memo,
	useCallback,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { FileTypeIcon } from "./review-icons";
import type { FileTreeNode } from "./review-types";
import { encodeFileId } from "./review-utils";

/**
 * Lightweight store so that only the old-active and new-active file nodes
 * re-render when the active file changes — not the entire tree.
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

function useIsActiveFile(store: ActiveFileStore, path: string): boolean {
	const subscribe = useCallback(
		(cb: () => void) => store.subscribe(cb),
		[store],
	);
	const getSnapshot = useCallback(() => store.get() === path, [store, path]);
	return useSyncExternalStore(subscribe, getSnapshot);
}

const ROW_HEIGHT = 29;
const INDENT = 12;

type FlatRow = {
	node: FileTreeNode;
	depth: number;
};

function collectFlatRows(
	nodes: FileTreeNode[],
	expanded: ReadonlySet<string>,
	depth: number,
	out: FlatRow[],
) {
	for (const node of nodes) {
		out.push({ node, depth });
		if (node.type === "directory" && expanded.has(node.path)) {
			collectFlatRows(node.children, expanded, depth + 1, out);
		}
	}
}

function collectAllDirectoryPaths(
	nodes: FileTreeNode[],
	out: Set<string>,
): Set<string> {
	for (const node of nodes) {
		if (node.type === "directory") {
			out.add(node.path);
			collectAllDirectoryPaths(node.children, out);
		}
	}
	return out;
}

export const ReviewVirtualizedFileTree = memo(
	function ReviewVirtualizedFileTree({
		tree,
		activeFileStore,
		onFileClick,
	}: {
		tree: FileTreeNode[];
		activeFileStore: ActiveFileStore;
		onFileClick: (path: string) => void;
	}) {
		// Default: every directory expanded. Once the user toggles something we
		// store their explicit override in a state Set.
		const defaultExpanded = useMemo(
			() => collectAllDirectoryPaths(tree, new Set<string>()),
			[tree],
		);
		const [explicitExpanded, setExplicitExpanded] =
			useState<Set<string> | null>(null);
		const expanded = explicitExpanded ?? defaultExpanded;

		const flatRows = useMemo(() => {
			const out: FlatRow[] = [];
			collectFlatRows(tree, expanded, 0, out);
			return out;
		}, [tree, expanded]);

		const toggleDirectory = useCallback(
			(path: string) => {
				setExplicitExpanded((prev) => {
					const base = prev ?? defaultExpanded;
					const next = new Set(base);
					if (next.has(path)) next.delete(path);
					else next.add(path);
					return next;
				});
			},
			[defaultExpanded],
		);

		const scrollRef = useRef<HTMLDivElement>(null);

		const virtualizer = useVirtualizer({
			count: flatRows.length,
			getScrollElement: () => scrollRef.current,
			estimateSize: () => ROW_HEIGHT,
			overscan: 12,
		});

		const items = virtualizer.getVirtualItems();
		const totalSize = virtualizer.getTotalSize();

		return (
			<div ref={scrollRef} className="flex-1 overflow-auto px-2 py-1">
				<div className="relative w-full" style={{ height: `${totalSize}px` }}>
					{items.map((virtualItem) => {
						const row = flatRows[virtualItem.index];
						if (!row) return null;
						const { node, depth } = row;
						return (
							<div
								key={virtualItem.key}
								className="absolute inset-x-0 top-0"
								style={{
									height: `${virtualItem.size}px`,
									transform: `translateY(${virtualItem.start}px)`,
								}}
							>
								{node.type === "directory" ? (
									<DirectoryRow
										node={node}
										depth={depth}
										isOpen={expanded.has(node.path)}
										onToggle={toggleDirectory}
									/>
								) : (
									<FileTreeLeaf
										node={node}
										depth={depth}
										activeFileStore={activeFileStore}
										onFileClick={onFileClick}
									/>
								)}
							</div>
						);
					})}
				</div>
			</div>
		);
	},
);

const DirectoryRow = memo(function DirectoryRow({
	node,
	depth,
	isOpen,
	onToggle,
}: {
	node: FileTreeNode;
	depth: number;
	isOpen: boolean;
	onToggle: (path: string) => void;
}) {
	return (
		<button
			type="button"
			aria-expanded={isOpen}
			className="flex h-7 w-full items-center gap-1.5 rounded-lg pr-2 text-[13px] font-medium text-text-nav transition-colors hover:bg-nav-hover hover:text-foreground"
			style={{ paddingLeft: `${depth * INDENT + 6}px` }}
			onClick={() => onToggle(node.path)}
		>
			<svg
				aria-hidden="true"
				className={cn(
					"size-3 shrink-0 text-icon-faint transition-transform",
					isOpen && "rotate-90",
				)}
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" />
			</svg>
			<FolderIcon
				size={14}
				strokeWidth={2}
				className="shrink-0 text-muted-foreground"
			/>
			<span className="truncate">{node.name}</span>
		</button>
	);
});

const FileTreeLeaf = memo(function FileTreeLeaf({
	node,
	depth,
	activeFileStore,
	onFileClick,
}: {
	node: FileTreeNode;
	depth: number;
	activeFileStore: ActiveFileStore;
	onFileClick: (path: string) => void;
}) {
	const isActive = useIsActiveFile(activeFileStore, node.path);
	const fileId = encodeFileId(node.path);

	return (
		<a
			href={`#${fileId}`}
			aria-current={isActive ? "location" : undefined}
			className={cn(
				"flex h-7 w-full items-center gap-1.5 rounded-lg pr-2 text-[13px] font-medium transition-colors",
				isActive
					? "bg-nav-selected text-foreground"
					: "text-text-nav hover:bg-nav-hover hover:text-foreground",
			)}
			style={{ paddingLeft: `${depth * INDENT + 24}px` }}
			onClick={() => onFileClick(node.path)}
		>
			<FileTypeIcon path={node.path} size={14} className="shrink-0" />
			<span
				className={cn(
					"min-w-0 truncate",
					node.status === "removed" && "line-through",
				)}
			>
				{node.name}
			</span>
			{(node.additions != null || node.deletions != null) && (
				<span className="ml-auto flex shrink-0 items-center gap-1 pl-2 text-[11px] font-[450] tabular-nums text-muted-foreground">
					{node.additions != null && node.additions > 0 && (
						<span>+{node.additions}</span>
					)}
					{node.deletions != null && node.deletions > 0 && (
						<span>-{node.deletions}</span>
					)}
				</span>
			)}
		</a>
	);
});
