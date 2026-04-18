import { ArchiveIcon, ArrowMoveDownRightIcon } from "@diffkit/icons";
import { Badge } from "@diffkit/ui/components/badge";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RepoStarForkActions } from "#/components/repo/repo-star-fork-actions";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";

function parseOwnerRepo(
	fullName: string,
): { owner: string; repo: string } | null {
	const i = fullName.indexOf("/");
	if (i <= 0 || i === fullName.length - 1) {
		return null;
	}
	return { owner: fullName.slice(0, i), repo: fullName.slice(i + 1) };
}

export function RepoHeader({
	repo,
	scope,
}: {
	repo: RepoOverview;
	scope: GitHubQueryScope;
}) {
	const [imgError, setImgError] = useState(false);
	const [forkImgError, setForkImgError] = useState(false);

	const forkLink = useMemo(() => {
		if (!repo.isFork || !repo.forkParentFullName) {
			return null;
		}
		return parseOwnerRepo(repo.forkParentFullName);
	}, [repo.isFork, repo.forkParentFullName]);

	return (
		<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex min-w-0 items-center gap-2">
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
					<div className="flex min-w-0 items-center gap-1.5 text-lg">
						<Link
							to="/$owner"
							params={{ owner: repo.owner }}
							className="inline-block min-w-0 max-w-[min(100%,14rem)] truncate font-medium text-accent-foreground transition-colors hover:underline"
						>
							{repo.owner}
						</Link>
						<span className="text-muted-foreground">/</span>
						<span className="min-w-0 max-w-[min(100%,20rem)] truncate font-semibold">
							{repo.name}
						</span>
					</div>
					<Badge
						variant="outline"
						className={cn(
							"ml-1 translate-y-px shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
							"border-border/60 text-muted-foreground",
						)}
					>
						{repo.isPrivate ? "Private" : "Public"}
					</Badge>
				</div>
				{forkLink && (
					<p className="flex min-w-0 flex-wrap items-center gap-2 text-sm md:ml-7">
						<ArrowMoveDownRightIcon
							size={14}
							strokeWidth={2}
							className="shrink-0 text-muted-foreground opacity-80"
							aria-hidden
						/>
						<span className="shrink-0 text-muted-foreground">forked from</span>
						{repo.forkParentOwnerAvatarUrl && !forkImgError ? (
							<img
								src={repo.forkParentOwnerAvatarUrl}
								alt=""
								className="size-4 shrink-0 rounded-sm object-cover"
								onError={() => setForkImgError(true)}
							/>
						) : (
							<ArchiveIcon
								size={14}
								className="shrink-0 text-muted-foreground opacity-80"
							/>
						)}
						<span className="flex min-w-0 items-center gap-1.5">
							<Link
								to="/$owner"
								params={{ owner: forkLink.owner }}
								className="inline-block min-w-0 max-w-[min(100%,12rem)] shrink-0 truncate font-medium text-foreground transition-colors hover:underline"
							>
								{forkLink.owner}
							</Link>
							<span className="text-muted-foreground">/</span>
							<Link
								to="/$owner/$repo"
								params={{
									owner: forkLink.owner,
									repo: forkLink.repo,
								}}
								className="min-w-0 max-w-[min(100%,18rem)] truncate font-semibold text-foreground transition-colors hover:underline"
							>
								{forkLink.repo}
							</Link>
						</span>
					</p>
				)}
			</div>
			<RepoStarForkActions repo={repo} scope={scope} />
		</div>
	);
}
