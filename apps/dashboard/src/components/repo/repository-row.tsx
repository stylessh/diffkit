import { GitForkIcon, LockIcon, RepoIcon, StarIcon } from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { lazy, memo, Suspense, useEffect, useRef, useState } from "react";
import {
	listRowClassName,
	listRowHoverClassName,
	RowStateIcon,
	RowTime,
} from "#/components/shared/list-row";
import { HighlightedText } from "#/components/shared/search-highlight";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { UserRepoSummary } from "#/lib/github.types";

const RepoCommitSparkline = lazy(() =>
	import("#/components/repo/repo-commit-sparkline").then((mod) => ({
		default: mod.RepoCommitSparkline,
	})),
);

const SparklinePlaceholder = (
	<div className="h-[22px] w-[78px] shrink-0" aria-hidden />
);

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

const visibilityLabel: Record<UserRepoSummary["visibility"], string> = {
	public: "Public repository",
	private: "Private repository",
	internal: "Internal repository",
};

export const RepositoryRow = memo(function RepositoryRow({
	repo,
	scope,
}: {
	repo: UserRepoSummary;
	scope: GitHubQueryScope;
}) {
	const VisibilityIcon = repo.visibility === "public" ? RepoIcon : LockIcon;
	const updated = repo.updatedAt
		? formatRelativeTime(repo.updatedAt, undefined, { compact: true })
		: null;

	return (
		<Link
			to="/$owner/$repo"
			params={{ owner: repo.owner, repo: repo.name }}
			aria-label={`${repo.fullName}, ${visibilityLabel[repo.visibility].toLowerCase()}`}
			className={cn(listRowClassName, listRowHoverClassName)}
		>
			<RowStateIcon className="text-muted-foreground">
				<span title={visibilityLabel[repo.visibility]} className="flex">
					<VisibilityIcon size={14} strokeWidth={2} />
				</span>
			</RowStateIcon>
			<div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-3">
				<p
					title={repo.fullName}
					className="min-w-0 shrink-0 truncate text-[13px] font-medium text-foreground md:max-w-[45%]"
				>
					<span className="text-muted-foreground">{repo.owner}/</span>
					<HighlightedText text={repo.name} />
				</p>
				{repo.description ? (
					<p className="min-w-0 truncate text-xs text-muted-foreground md:text-[13px]">
						{repo.description}
					</p>
				) : null}
			</div>
			<div className="hidden shrink-0 items-center gap-1 md:flex">
				{repo.language ? (
					<Chip>
						<span
							aria-hidden
							className="flex size-2 shrink-0 items-center justify-center"
						>
							<span
								className="size-1.5 rounded-full"
								style={{
									backgroundColor:
										languageColors[repo.language] ?? "var(--muted-foreground)",
								}}
							/>
						</span>
						{repo.language}
					</Chip>
				) : null}
				{repo.stars > 0 ? (
					<Chip className="tabular-nums" title={`${repo.stars} stars`}>
						<StarIcon size={12} strokeWidth={2} />
						{formatCount(repo.stars)}
					</Chip>
				) : null}
				{repo.forks > 0 ? (
					<Chip className="tabular-nums" title={`${repo.forks} forks`}>
						<GitForkIcon size={12} strokeWidth={2} />
						{formatCount(repo.forks)}
					</Chip>
				) : null}
				<Chip
					className="hidden overflow-hidden p-px lg:inline-flex"
					title="Commits per week, last year"
				>
					<LazyRepoCommitSparkline
						scope={scope}
						owner={repo.owner}
						repo={repo.name}
					/>
				</Chip>
			</div>
			<span className="hidden shrink-0 md:ml-3 md:flex">
				<RowTime>{updated}</RowTime>
			</span>
		</Link>
	);
});

function LazyRepoCommitSparkline({
	scope,
	owner,
	repo,
}: {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [showChart, setShowChart] = useState(false);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) {
					setShowChart(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "240px 0px", threshold: 0 },
		);

		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={containerRef} className="flex items-center">
			{showChart ? (
				<Suspense fallback={SparklinePlaceholder}>
					<RepoCommitSparkline scope={scope} owner={owner} repo={repo} />
				</Suspense>
			) : (
				SparklinePlaceholder
			)}
		</div>
	);
}

function formatCount(count: number): string {
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	}
	return count.toString();
}
