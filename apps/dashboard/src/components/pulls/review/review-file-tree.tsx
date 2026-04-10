import { FileIcon, FolderIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useState } from "react";
import type { FileTreeNode } from "./review-types";
import { encodeFileId } from "./review-utils";

export function ReviewFileTreeNode({
	node,
	depth,
	activeFile,
	onFileClick,
}: {
	node: FileTreeNode;
	depth: number;
	activeFile: string | null;
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
								activeFile={activeFile}
								onFileClick={onFileClick}
							/>
						))}
					</div>
				)}
			</div>
		);
	}

	const isActive = activeFile === node.path;
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
}
