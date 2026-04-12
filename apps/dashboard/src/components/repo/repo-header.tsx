import { ArchiveIcon } from "@diffkit/icons";
import { Badge } from "@diffkit/ui/components/badge";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { RepoOverview } from "#/lib/github.types";

export function RepoHeader({ repo }: { repo: RepoOverview }) {
	const [imgError, setImgError] = useState(false);

	return (
		<div className="flex items-center gap-2">
			{repo.ownerAvatarUrl && !imgError ? (
				<img
					src={repo.ownerAvatarUrl}
					alt={repo.owner}
					className="size-5 shrink-0 rounded-md"
					onError={() => setImgError(true)}
				/>
			) : (
				<ArchiveIcon size={16} className="shrink-0 text-muted-foreground" />
			)}
			<div className="flex items-center gap-1.5 text-lg">
				<Link
					to="/$owner"
					params={{ owner: repo.owner }}
					className="font-medium text-accent-foreground transition-colors hover:underline"
				>
					{repo.owner}
				</Link>
				<span className="text-muted-foreground">/</span>
				<span className="font-semibold">{repo.name}</span>
			</div>
			<Badge
				variant="outline"
				className={cn(
					"ml-1 translate-y-px rounded-full px-2 py-0.5 text-[11px] font-medium",
					"border-border/60 text-muted-foreground",
				)}
			>
				{repo.isPrivate ? "Private" : "Public"}
			</Badge>
		</div>
	);
}
