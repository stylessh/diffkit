import { DownloadIcon, PackageIcon } from "@diffkit/icons";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@diffkit/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkflowRunArtifact } from "#/lib/github.types";

export function WorkflowRunArtifacts({
	artifacts,
}: {
	artifacts: WorkflowRunArtifact[];
}) {
	if (artifacts.length === 0) return null;

	return (
		<section
			id="artifacts"
			className="flex flex-col gap-3 overflow-hidden rounded-xl border bg-surface-1"
		>
			<div className="flex items-center justify-between px-4 pt-3">
				<h2 className="font-medium text-sm">Artifacts</h2>
				<span className="text-muted-foreground text-xs tabular-nums">
					{artifacts.length}
				</span>
			</div>
			<Table className="text-sm">
				<TableHeader>
					<TableRow className="border-b hover:bg-transparent">
						<TableHead className="pl-4 font-normal text-muted-foreground text-xs">
							Name
						</TableHead>
						<TableHead className="font-normal text-muted-foreground text-xs">
							Size
						</TableHead>
						<TableHead className="font-normal text-muted-foreground text-xs">
							Digest
						</TableHead>
						<TableHead className="w-10 pr-4" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{artifacts.map((artifact) => (
						<ArtifactRow key={artifact.id} artifact={artifact} />
					))}
				</TableBody>
			</Table>
		</section>
	);
}

function ArtifactRow({ artifact }: { artifact: WorkflowRunArtifact }) {
	const isDownloadable = !artifact.expired;
	return (
		<TableRow className="hover:bg-muted/30">
			<TableCell className="pl-4">
				<div className="flex min-w-0 items-center gap-2">
					<PackageIcon
						size={15}
						strokeWidth={2}
						className="shrink-0 text-muted-foreground"
					/>
					{isDownloadable ? (
						<a
							href={artifact.archiveDownloadUrl}
							className="min-w-0 truncate font-medium hover:underline"
						>
							{artifact.name}
						</a>
					) : (
						<span className="min-w-0 truncate font-medium text-muted-foreground">
							{artifact.name}
						</span>
					)}
					{artifact.expired ? (
						<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
							Expired
						</span>
					) : null}
				</div>
			</TableCell>
			<TableCell className="text-muted-foreground tabular-nums">
				{formatSize(artifact.sizeInBytes)}
			</TableCell>
			<TableCell className="min-w-0">
				{artifact.digest ? (
					<DigestCell digest={artifact.digest} />
				) : (
					<span className="text-muted-foreground/60">—</span>
				)}
			</TableCell>
			<TableCell className="pr-4 text-right">
				{isDownloadable ? (
					<a
						href={artifact.archiveDownloadUrl}
						aria-label={`Download ${artifact.name}`}
						className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<DownloadIcon size={14} strokeWidth={2} />
					</a>
				) : null}
			</TableCell>
		</TableRow>
	);
}

function DigestCell({ digest }: { digest: string }) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(digest);
			setCopied(true);
			clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	}, [digest]);

	useEffect(() => () => clearTimeout(timeoutRef.current), []);

	return (
		<Tooltip open={copied}>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={handleCopy}
					aria-label="Copy digest"
					className="flex min-w-0 cursor-pointer items-center truncate font-mono text-sm text-primary transition-opacity hover:opacity-80"
				>
					<span className="min-w-0 truncate">{digest}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent>Copied!</TooltipContent>
		</Tooltip>
	);
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
