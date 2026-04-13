import { GitForkIcon, StarIcon } from "@diffkit/icons";
import { Link } from "@tanstack/react-router";
import type { PinnedRepo } from "#/lib/github.types";

export function PinnedRepoCard({ repo }: { repo: PinnedRepo }) {
	return (
		<Link
			to="/$owner/$repo"
			params={{ owner: repo.owner, repo: repo.name }}
			className="flex flex-col gap-2 rounded-xl bg-surface-1 p-4"
		>
			<div className="flex items-center gap-2 min-w-0">
				<span className="truncate text-sm font-semibold text-foreground">
					{repo.name}
				</span>
				{repo.isPrivate && (
					<span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
						Private
					</span>
				)}
			</div>

			{repo.description && (
				<p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
					{repo.description}
				</p>
			)}

			<div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
				{repo.language && (
					<span className="flex items-center gap-1.5">
						<span
							className="inline-block size-2.5 rounded-full"
							style={{ backgroundColor: repo.languageColor ?? "var(--muted)" }}
						/>
						{repo.language}
					</span>
				)}
				{repo.stars > 0 && (
					<span className="flex items-center gap-1">
						<StarIcon size={13} strokeWidth={1.75} />
						{formatStars(repo.stars)}
					</span>
				)}
				{repo.forks > 0 && (
					<span className="flex items-center gap-1">
						<GitForkIcon size={13} strokeWidth={1.75} />
						{formatStars(repo.forks)}
					</span>
				)}
			</div>
		</Link>
	);
}

function formatStars(count: number): string {
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	}
	return count.toString();
}
