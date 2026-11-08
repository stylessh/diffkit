import { DownloadIcon, FileIcon, PackageIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { cardRowClassName } from "#/components/repo/repo-ui";
import { encodeRefPath } from "#/lib/commits-route";
import type { RepoRelease } from "#/lib/github.types";
import { formatBytes } from "./release-save-utils";

type AssetRow = {
	id: string;
	name: string;
	href: string;
	size: number | null;
	downloads: number | null;
	isSource: boolean;
};

function releaseAssetRows(
	owner: string,
	repo: string,
	release: RepoRelease,
): AssetRow[] {
	const rows: AssetRow[] = release.assets.map((asset) => ({
		id: String(asset.id),
		name: asset.name,
		href: asset.downloadUrl,
		size: asset.size,
		downloads: asset.downloadCount,
		isSource: false,
	}));
	// Drafts may point at a tag that doesn't exist yet, so no source archives.
	if (!release.isDraft) {
		const base = `https://github.com/${owner}/${repo}/archive/refs/tags/${encodeRefPath(release.tagName)}`;
		rows.push(
			{
				id: "source-zip",
				name: "Source code (zip)",
				href: `${base}.zip`,
				size: null,
				downloads: null,
				isSource: true,
			},
			{
				id: "source-tar",
				name: "Source code (tar.gz)",
				href: `${base}.tar.gz`,
				size: null,
				downloads: null,
				isSource: true,
			},
		);
	}
	return rows;
}

export function releaseAssetCount(release: RepoRelease) {
	return release.assets.length + (release.isDraft ? 0 : 2);
}

/** Uploaded assets (with size and download count) plus GitHub's source archives. */
export function ReleaseAssets({
	owner,
	repo,
	release,
	collapsible = false,
	className,
}: {
	owner: string;
	repo: string;
	release: RepoRelease;
	/** List cards fold assets behind a summary; the detail page shows them open. */
	collapsible?: boolean;
	className?: string;
}) {
	const rows = releaseAssetRows(owner, repo, release);
	if (rows.length === 0) return null;

	const list = (
		<ul>
			{rows.map((row) => (
				<li key={row.id}>
					<a
						href={row.href}
						rel="noopener noreferrer"
						className={cardRowClassName}
					>
						{row.isSource ? (
							<FileIcon size={14} className="shrink-0 text-muted-foreground" />
						) : (
							<PackageIcon
								size={14}
								className="shrink-0 text-muted-foreground"
							/>
						)}
						<span
							className={cn(
								"min-w-0 flex-1 truncate text-[13px]",
								row.isSource
									? "font-[450] text-muted-foreground"
									: "font-medium text-foreground",
							)}
						>
							{row.name}
						</span>
						{row.downloads != null ? (
							<span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
								{row.downloads.toLocaleString()} download
								{row.downloads === 1 ? "" : "s"}
							</span>
						) : null}
						{row.size != null ? (
							<span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
								{formatBytes(row.size)}
							</span>
						) : null}
						<DownloadIcon
							size={14}
							className="shrink-0 text-muted-foreground"
						/>
					</a>
				</li>
			))}
		</ul>
	);

	const header = (
		<span className="flex items-center gap-2 text-[13px] font-medium text-text-header">
			Assets
			<span className="font-[450] tabular-nums text-muted-foreground">
				{rows.length}
			</span>
		</span>
	);

	if (collapsible) {
		return (
			<details
				className={cn(
					"group overflow-hidden rounded-lg bg-surface-0 shadow-card",
					className,
				)}
			>
				<summary className="flex h-9 cursor-pointer list-none items-center justify-between px-4 transition-colors hover:bg-item-hover [&::-webkit-details-marker]:hidden">
					{header}
					<span className="text-xs text-muted-foreground group-open:hidden">
						Show
					</span>
					<span className="hidden text-xs text-muted-foreground group-open:inline">
						Hide
					</span>
				</summary>
				<div className="border-t-[0.5px] border-card-border">{list}</div>
			</details>
		);
	}

	return (
		<section
			className={cn(
				"overflow-hidden rounded-lg bg-surface-0 shadow-card",
				className,
			)}
		>
			<div className="flex h-9 items-center border-b-[0.5px] border-card-border px-4">
				{header}
			</div>
			{list}
		</section>
	);
}
