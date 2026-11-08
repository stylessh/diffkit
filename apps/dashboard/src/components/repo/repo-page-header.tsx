import { CloseIcon, SearchIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { RepoNav, type RepoNavKey } from "#/components/repo/repo-nav";
import type { RepoOverview } from "#/lib/github.types";

/**
 * Title block for repo subpages (commits, branches, tags, releases): the repo
 * section nav, then the page heading with an optional action slot.
 */
export function RepoPageHeader({
	owner,
	repo,
	repoData,
	active,
	title,
	subtitle,
	actions,
}: {
	owner: string;
	repo: string;
	repoData?: RepoOverview | null;
	active: RepoNavKey;
	title: ReactNode;
	subtitle?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-5">
			<RepoNav owner={owner} repo={repo} active={active} repoData={repoData} />
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex min-w-0 flex-col gap-2">
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					<p className="text-sm text-muted-foreground">
						<Link
							to="/$owner/$repo"
							params={{ owner, repo }}
							className="text-muted-foreground underline-offset-2 hover:underline"
						>
							{owner}/{repo}
						</Link>
						{subtitle ? <span> · {subtitle}</span> : null}
					</p>
				</div>
				{actions ? (
					<div className="flex shrink-0 items-center gap-2">{actions}</div>
				) : null}
			</div>
		</div>
	);
}

/** Search box styled like the list `FilterBar` input. */
export function RepoListSearchInput({
	value,
	onChange,
	placeholder,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex min-w-0 items-center gap-2 rounded-lg border border-border/50 bg-surface-1 px-3 py-1.5 transition-colors focus-within:border-border",
				className,
			)}
		>
			<SearchIcon size={14} className="shrink-0 text-muted-foreground" />
			<input
				type="text"
				aria-label={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
			/>
			{value ? (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear search"
					className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
				>
					<CloseIcon size={13} />
				</button>
			) : null}
		</div>
	);
}
