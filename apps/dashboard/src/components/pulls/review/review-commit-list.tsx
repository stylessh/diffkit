import { Link } from "@tanstack/react-router";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { PullCommit } from "#/lib/github.types";

/** The pull request's commits, sized for the review page's side panel. */
export function ReviewCommitList({
	commits,
	owner,
	repo,
}: {
	commits: PullCommit[];
	owner: string;
	repo: string;
}) {
	if (commits.length === 0) {
		return (
			<p className="px-4 py-8 text-center text-[13px] font-[450] text-muted-foreground">
				No commits yet.
			</p>
		);
	}

	return (
		<ol
			aria-label="Commits"
			className="flex h-full flex-col gap-px overflow-y-auto px-2 pt-1 pb-4"
		>
			{commits.map((commit) => (
				<li key={commit.sha}>
					<Link
						to="/$owner/$repo/commit/$sha"
						params={{ owner, repo, sha: commit.sha }}
						className="flex flex-col gap-1 rounded-lg px-2.5 py-2 transition-colors hover:bg-nav-hover"
					>
						<span className="truncate text-[13px] font-medium text-text-nav">
							{commit.message.split("\n")[0]}
						</span>
						<span className="flex items-center gap-1.5 text-xs font-[450] text-muted-foreground">
							{commit.author ? (
								<>
									<img
										src={commit.author.avatarUrl}
										alt=""
										className="size-3.5 shrink-0 rounded-full"
									/>
									<span className="min-w-0 truncate">
										{commit.author.login}
									</span>
								</>
							) : null}
							<code className="shrink-0 font-mono text-[11px] text-icon-faint">
								{commit.sha.slice(0, 7)}
							</code>
							<time
								dateTime={commit.createdAt}
								className="ml-auto shrink-0 tabular-nums"
							>
								{formatRelativeTime(commit.createdAt)}
							</time>
						</span>
					</Link>
				</li>
			))}
		</ol>
	);
}
