import { GitForkIcon, StarIcon } from "@diffkit/icons";
import { Link } from "@tanstack/react-router";

type RepositoryCardRepo = {
	name: string;
	owner: string;
	description: string | null;
	language: string | null;
	stars: number;
	forks?: number;
	isPrivate: boolean;
};

const languageColors: Record<string, string> = {
	Astro: "#ff5a03",
	CSS: "#563d7c",
	Go: "#00add8",
	HTML: "#e34c26",
	JavaScript: "#f1e05a",
	MDX: "#fcb32c",
	Python: "#3572a5",
	Rust: "#dea584",
	Shell: "#89e051",
	Swift: "#f05138",
	TypeScript: "#3178c6",
};

export function RepositoryCard({ repo }: { repo: RepositoryCardRepo }) {
	return (
		<Link
			to="/$owner/$repo"
			params={{ owner: repo.owner, repo: repo.name }}
			className="flex h-32 flex-col gap-2 rounded-xl bg-surface-1 p-4"
		>
			<div className="flex min-w-0 items-center gap-2">
				<span className="truncate text-sm font-semibold text-foreground">
					{repo.name}
				</span>
				<span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
					{repo.isPrivate ? "Private" : "Public"}
				</span>
			</div>

			<div className="min-h-[2.5rem]">
				{repo.description && (
					<p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
						{repo.description}
					</p>
				)}
			</div>

			<div className="mt-auto flex min-h-4 items-center gap-3 text-xs text-muted-foreground">
				{repo.language && (
					<span className="flex items-center gap-1.5">
						<span
							className="inline-block size-2.5 rounded-full"
							style={{
								backgroundColor:
									languageColors[repo.language] ?? "var(--muted)",
							}}
						/>
						{repo.language}
					</span>
				)}
				{repo.stars > 0 && (
					<span className="flex items-center gap-1">
						<StarIcon size={13} strokeWidth={1.75} />
						{formatCount(repo.stars)}
					</span>
				)}
				{typeof repo.forks === "number" && repo.forks > 0 && (
					<span className="flex items-center gap-1">
						<GitForkIcon size={13} strokeWidth={1.75} />
						{formatCount(repo.forks)}
					</span>
				)}
			</div>
		</Link>
	);
}

function formatCount(count: number): string {
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	}
	return count.toString();
}
