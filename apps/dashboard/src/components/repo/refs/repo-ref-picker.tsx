import { CheckIcon, ChevronDownIcon, GitBranchIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
	type GitHubQueryScope,
	githubRepoRefNamesQueryOptions,
} from "#/lib/github.query";
import type { RepoRefKind } from "#/lib/github.types";
import { TagIcon } from "./tag-icon";

const SHA_RE = /^[0-9a-f]{7,40}$/i;

/**
 * Branch/tag switcher. Loads the first 100 names of the visible kind when the
 * popover opens (one cached request per kind); hover prefetches branches.
 */
export function RepoRefPicker({
	owner,
	repo,
	scope,
	currentRef,
	defaultBranch,
	onSelect,
	align = "start",
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	currentRef: string;
	defaultBranch: string;
	onSelect: (ref: string) => void;
	align?: "start" | "end";
}) {
	const [open, setOpen] = useState(false);
	const [kind, setKind] = useState<RepoRefKind>("branches");
	const queryClient = useQueryClient();

	const branchesOptions = githubRepoRefNamesQueryOptions(scope, {
		owner,
		repo,
		kind: "branches",
	});
	const tagsOptions = githubRepoRefNamesQueryOptions(scope, {
		owner,
		repo,
		kind: "tags",
	});
	const branchesQuery = useQuery({
		...branchesOptions,
		enabled: open && kind === "branches",
	});
	const tagsQuery = useQuery({
		...tagsOptions,
		enabled: open && kind === "tags",
	});
	const activeQuery = kind === "branches" ? branchesQuery : tagsQuery;

	const prefetch = useCallback(() => {
		void queryClient.prefetchQuery(branchesOptions);
	}, [queryClient, branchesOptions]);

	const isTag = Boolean(tagsQuery.data?.names.includes(currentRef));
	const isSha = SHA_RE.test(currentRef) && currentRef !== defaultBranch;

	const names = useMemo(() => {
		const loaded = activeQuery.data?.names ?? [];
		if (kind === "tags") return loaded;
		return [defaultBranch, ...loaded.filter((name) => name !== defaultBranch)];
	}, [activeQuery.data?.names, defaultBranch, kind]);

	const select = (ref: string) => {
		onSelect(ref);
		setOpen(false);
	};

	const TriggerIcon = isTag ? TagIcon : GitBranchIcon;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="secondary"
					size="sm"
					onMouseEnter={prefetch}
					onFocus={prefetch}
					aria-label={`Switch branch or tag, current ${currentRef}`}
					className="max-w-[240px] border-[0.5px] border-border dark:border-transparent"
				>
					<TriggerIcon size={14} />
					<span className={cn("truncate", isSha && "font-mono text-xs")}>
						{isSha ? currentRef.slice(0, 7) : currentRef}
					</span>
					<ChevronDownIcon size={14} className="shrink-0 opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align={align}>
				<div className="flex gap-1 border-b-[0.5px] p-1.5">
					{(["branches", "tags"] as const).map((value) => (
						<button
							key={value}
							type="button"
							onClick={() => setKind(value)}
							aria-pressed={kind === value}
							className={cn(
								"flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
								kind === value
									? "bg-surface-1 font-medium text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{value === "branches" ? (
								<GitBranchIcon size={12} />
							) : (
								<TagIcon size={12} />
							)}
							{value === "branches" ? "Branches" : "Tags"}
						</button>
					))}
				</div>
				<Command key={kind}>
					<CommandInput
						placeholder={kind === "branches" ? "Find a branch…" : "Find a tag…"}
					/>
					<CommandList>
						<CommandEmpty>
							{activeQuery.isLoading
								? "Loading…"
								: kind === "branches"
									? "No branches found."
									: "No tags found."}
						</CommandEmpty>
						{names.map((name) => (
							<CommandItem
								key={name}
								value={name}
								onSelect={() => select(name)}
								className={cn(
									name === currentRef && "font-medium text-foreground",
								)}
							>
								<CheckIcon
									size={14}
									className={cn(
										"shrink-0",
										name === currentRef ? "opacity-100" : "opacity-0",
									)}
								/>
								<span className="truncate">{name}</span>
								{kind === "branches" && name === defaultBranch ? (
									<span className="ml-auto text-[10px] text-muted-foreground">
										default
									</span>
								) : null}
							</CommandItem>
						))}
					</CommandList>
				</Command>
				<div className="flex items-center justify-between border-t-[0.5px] px-3 py-2 text-xs">
					<span className="text-muted-foreground">
						{activeQuery.data?.truncated ? "Showing first 100" : null}
					</span>
					<Link
						to={
							kind === "branches"
								? "/$owner/$repo/branches"
								: "/$owner/$repo/tags"
						}
						params={{ owner, repo }}
						onClick={() => setOpen(false)}
						className="font-medium text-muted-foreground hover:text-foreground hover:underline"
					>
						View all {kind}
					</Link>
				</div>
			</PopoverContent>
		</Popover>
	);
}
