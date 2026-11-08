import { GitForkIcon, StarIcon } from "@diffkit/icons";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { forkRepository, setRepoStarred } from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";
import { checkPermissionWarning } from "#/lib/warning-store";
import { pillButtonClassName } from "./repo-ui";

function formatCount(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return String(n);
}

export function RepoStarForkActions({
	repo,
	scope,
}: {
	repo: RepoOverview;
	scope: GitHubQueryScope;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const starFlight = useRef(false);
	const [forkPending, setForkPending] = useState(false);

	const overviewKey = githubQueryKeys.repo.overview(scope, {
		owner: repo.owner,
		repo: repo.name,
	});

	const handleStar = async () => {
		if (starFlight.current) {
			return;
		}
		starFlight.current = true;
		const nextStarred = !repo.viewerHasStarred;
		const delta = nextStarred ? 1 : -1;
		const previous = queryClient.getQueryData<RepoOverview>(overviewKey);

		// Keep optimistic cache on success — invalidating refetches and flickers.
		queryClient.setQueryData(overviewKey, (old: RepoOverview | undefined) => {
			if (!old) {
				return old;
			}
			return {
				...old,
				viewerHasStarred: nextStarred,
				stars: Math.max(0, old.stars + delta),
			};
		});

		try {
			const result = await setRepoStarred({
				data: {
					owner: repo.owner,
					repo: repo.name,
					starred: nextStarred,
				},
			});
			if (!result.ok) {
				queryClient.setQueryData(overviewKey, previous);
				toast.error(result.error);
				checkPermissionWarning(result, `${repo.owner}/${repo.name}`);
			}
		} catch {
			queryClient.setQueryData(overviewKey, previous);
			toast.error("Failed to update star");
		} finally {
			starFlight.current = false;
		}
	};

	const handleFork = async () => {
		setForkPending(true);
		try {
			const result = await forkRepository({
				data: { owner: repo.owner, repo: repo.name },
			});
			if (result.ok) {
				void navigate({
					to: "/$owner/$repo",
					params: { owner: result.forkOwner, repo: result.forkName },
				});
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${repo.owner}/${repo.name}`);
			}
		} catch {
			toast.error("Failed to fork repository");
		} finally {
			setForkPending(false);
		}
	};

	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<button
				type="button"
				onClick={() => void handleStar()}
				aria-pressed={repo.viewerHasStarred}
				className={pillButtonClassName}
			>
				<StarIcon
					size={14}
					strokeWidth={2}
					className={cn(
						repo.viewerHasStarred
							? "fill-warning text-warning"
							: "text-muted-foreground",
					)}
				/>
				<span className="max-sm:sr-only">
					{repo.viewerHasStarred ? "Starred" : "Star"}
				</span>
				<span className="tabular-nums text-muted-foreground">
					{formatCount(repo.stars)}
				</span>
			</button>
			<button
				type="button"
				disabled={forkPending}
				onClick={() => void handleFork()}
				className={pillButtonClassName}
			>
				{forkPending ? (
					<Spinner size={12} />
				) : (
					<GitForkIcon
						size={14}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
				)}
				<span className="max-sm:sr-only">Fork</span>
				<span className="tabular-nums text-muted-foreground">
					{formatCount(repo.forks)}
				</span>
			</button>
		</div>
	);
}
