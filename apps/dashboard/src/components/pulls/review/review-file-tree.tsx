import { FileIcon, FolderIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { memo, useCallback, useState, useSyncExternalStore } from "react";
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

export const ReviewFileTreeNode = memo(function ReviewFileTreeNode({
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
	const [isOpen, setIsOpen] = useState(true);

	if (node.type === "directory") {
		return (
			<div>
				<button
					type="button"
					className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
					style={{ paddingLeft: `${depth * 12 + 12}px` }}
					onClick={() => setIsOpen(!isOpen)}
				>
					<svg
						aria-hidden="true"
						className={cn(
							"size-3 shrink-0 text-muted-foreground/60 transition-transform",
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
					<span className="truncate font-medium">{node.name}</span>
				</button>
				{isOpen && (
					<div>
						{node.children.map((child) => (
							<ReviewFileTreeNode
								key={child.path}
								node={child}
								depth={depth + 1}
								activeFileStore={activeFileStore}
								onFileClick={onFileClick}
							/>
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<FileTreeLeaf
			node={node}
			depth={depth}
			activeFileStore={activeFileStore}
			onFileClick={onFileClick}
		/>
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
			className={cn(
				"flex w-full items-center gap-1.5 px-3 py-1.5 text-[13px] transition-colors hover:bg-surface-1",
				isActive ? "bg-surface-1 text-foreground" : "text-muted-foreground",
			)}
			style={{ paddingLeft: `${depth * 12 + 30}px` }}
			onClick={() => onFileClick(node.path)}
		>
			<FileIcon
				size={14}
				strokeWidth={2}
				className="shrink-0 text-muted-foreground"
			/>
			<span
				className={cn("truncate", node.status === "removed" && "line-through")}
			>
				{node.name}
			</span>
			{(node.additions != null || node.deletions != null) && (
				<span className="ml-auto flex shrink-0 items-center gap-1 font-mono tabular-nums">
					{node.additions != null && node.additions > 0 && (
						<span className="text-green-500">+{node.additions}</span>
					)}
					{node.deletions != null && node.deletions > 0 && (
						<span className="text-red-500">-{node.deletions}</span>
					)}
				</span>
			)}
		</a>
	);
});
