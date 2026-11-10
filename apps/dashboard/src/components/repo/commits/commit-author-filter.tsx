import { CheckIcon, ChevronDownIcon, FollowersIcon } from "@diffkit/icons";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@diffkit/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PickerSkeletonRows } from "#/components/shared/picker-skeleton-rows";
import {
	type GitHubQueryScope,
	githubRepoContributorsQueryOptions,
} from "#/lib/github.query";
import type { RepoCommitSummary } from "#/lib/github.types";
import { pillButtonClassName } from "../repo-ui";

type AuthorOption = { login: string; avatarUrl: string };

/**
 * Author filter. Options are the repo's top contributors (one cached request,
 * loaded on open) merged with authors visible on the current page.
 */
export function CommitAuthorFilter({
	owner,
	repo,
	scope,
	value,
	onChange,
	pageCommits,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	value: string | null;
	onChange: (author: string | null) => void;
	pageCommits: readonly RepoCommitSummary[];
}) {
	const [open, setOpen] = useState(false);
	const contributorsQuery = useQuery({
		...githubRepoContributorsQueryOptions(scope, { owner, repo }),
		enabled: open,
	});

	const options = useMemo(() => {
		const seen = new Map<string, AuthorOption>();
		for (const commit of pageCommits) {
			if (commit.author) {
				seen.set(commit.author.login.toLowerCase(), {
					login: commit.author.login,
					avatarUrl: commit.author.avatarUrl,
				});
			}
		}
		for (const contributor of contributorsQuery.data?.contributors ?? []) {
			const key = contributor.login.toLowerCase();
			if (!seen.has(key)) {
				seen.set(key, {
					login: contributor.login,
					avatarUrl: contributor.avatarUrl,
				});
			}
		}
		return [...seen.values()];
	}, [contributorsQuery.data?.contributors, pageCommits]);

	const selected = value
		? options.find(
				(option) => option.login.toLowerCase() === value.toLowerCase(),
			)
		: null;

	const pick = (author: string | null) => {
		onChange(author);
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={value ? `Author: ${value}` : "Filter by author"}
					className={cn(pillButtonClassName, "max-w-[200px]")}
				>
					{selected ? (
						<img
							src={selected.avatarUrl}
							alt=""
							className="size-4 rounded-full ring-[0.5px] ring-chip-border"
						/>
					) : (
						<FollowersIcon size={14} className="text-muted-foreground" />
					)}
					<span className="truncate">{value ?? "All authors"}</span>
					<ChevronDownIcon
						size={12}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-0" align="end">
				<Command>
					<CommandInput placeholder="Find an author…" />
					<CommandList>
						{contributorsQuery.isPending ? null : (
							<CommandEmpty>No authors found.</CommandEmpty>
						)}
						<CommandItem value="__all_authors__" onSelect={() => pick(null)}>
							<CheckIcon
								size={14}
								className={cn("shrink-0", value ? "opacity-0" : "opacity-100")}
							/>
							All authors
						</CommandItem>
						{options.map((option) => {
							const isSelected =
								value?.toLowerCase() === option.login.toLowerCase();
							return (
								<CommandItem
									key={option.login}
									value={option.login}
									onSelect={() => pick(option.login)}
								>
									<CheckIcon
										size={14}
										className={cn(
											"shrink-0",
											isSelected ? "opacity-100" : "opacity-0",
										)}
									/>
									<img
										src={option.avatarUrl}
										alt=""
										className="size-4 shrink-0 rounded-full"
									/>
									<span className="truncate">{option.login}</span>
								</CommandItem>
							);
						})}
						{contributorsQuery.isPending ? (
							<PickerSkeletonRows label="Loading authors" leading="avatar" />
						) : null}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
