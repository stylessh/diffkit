import { GitCommitIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { buildCommitsSplat } from "#/lib/commits-route";
import { ghostPillClassName } from "../repo-ui";

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
			className={cn(ghostPillClassName, className)}
		>
			<GitCommitIcon size={14} strokeWidth={2} />
			<span className="hidden sm:inline">History</span>
		</Link>
	);
}
