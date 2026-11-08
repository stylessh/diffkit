import { ClockIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { buildCommitsSplat } from "#/lib/commits-route";

/** "History" link from a tree/blob view into `/commits/$ref[/path]`. */
export function CommitHistoryLink({
	owner,
	repo,
	ref,
	path,
	className,
}: {
	owner: string;
	repo: string;
	ref: string;
	path?: string;
	className?: string;
}) {
	return (
		<Link
			to="/$owner/$repo/commits/$"
			params={{ owner, repo, _splat: buildCommitsSplat(ref, path) }}
			aria-label={path ? `History for ${path}` : `Commit history for ${ref}`}
			className={cn(
				"flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
				className,
			)}
		>
			<ClockIcon size={14} />
			<span className="hidden sm:inline">History</span>
		</Link>
	);
}
