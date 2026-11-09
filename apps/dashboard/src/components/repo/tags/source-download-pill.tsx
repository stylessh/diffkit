import { ChevronDownIcon, DownloadIcon } from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { encodeRefPath } from "#/lib/commits-route";

const FORMATS = ["zip", "tar.gz"] as const;

/**
 * A tag's source archive as one split pill: the pill downloads the zip, the
 * chevron offers every format.
 */
export function SourceDownloadPill({
	owner,
	repo,
	tag,
}: {
	owner: string;
	repo: string;
	tag: string;
}) {
	const archiveBase = `https://github.com/${owner}/${repo}/archive/refs/tags/${encodeRefPath(tag)}`;

	return (
		<span className="flex h-6 shrink-0 items-center overflow-hidden rounded-full bg-chip text-xs font-[450] text-muted-foreground shadow-chip">
			<a
				href={`${archiveBase}.zip`}
				data-action
				title={`Download ${tag} source code (zip)`}
				className="flex h-full items-center gap-1.5 pr-1 pl-2 transition-colors hover:text-foreground"
			>
				<DownloadIcon size={12} strokeWidth={2} />
				zip
			</a>
			<DropdownMenu>
				<DropdownMenuTrigger
					data-action
					aria-label={`Choose a source code format for ${tag}`}
					className="flex h-full items-center pr-2 pl-1 transition-colors hover:text-foreground data-[state=open]:text-foreground"
				>
					<ChevronDownIcon size={12} strokeWidth={2} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{FORMATS.map((format) => (
						<DropdownMenuItem key={format} asChild>
							<a href={`${archiveBase}.${format}`}>
								<DownloadIcon size={14} strokeWidth={2} />
								Source code ({format})
							</a>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</span>
	);
}
