import {
	CheckIcon,
	ChevronDownIcon,
	CodeIcon,
	CopyIcon,
	DownloadIcon,
	FileIcon,
	FolderIcon,
	GitBranchIcon,
	SearchIcon,
} from "@diffkit/icons";
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
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@diffkit/ui/components/tabs";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import { type FileSearchEntry, searchFiles } from "#/lib/fuzzy-file-search";
import {
	type GitHubQueryScope,
	githubRepoBranchesQueryOptions,
} from "#/lib/github.query";
import type { RepoOverview, RepoTreeEntry } from "#/lib/github.types";
import { useRepoCloneProtocol } from "#/lib/repo-clone-protocol-storage";
import { useGlobalShortcuts } from "#/lib/shortcuts";
import { ghostPillClassName, KeyHint, pillButtonClassName } from "./repo-ui";

/**
 * The overview's branch bar, as the reference draws it: the branch in a
 * raised pill, the branch and tag counts as ghost pills, then "Go to file"
 * and Code at the right.
 */
export function CodeExplorerToolbar({
	repo,
	currentRef,
	scope,
	onBranchChange,
}: {
	repo: RepoOverview;
	currentRef: string;
	scope: GitHubQueryScope;
	onBranchChange: (branch: string) => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<BranchSelector
				repo={repo}
				currentRef={currentRef}
				scope={scope}
				onBranchChange={onBranchChange}
			/>
			<Link
				to="/$owner/$repo/branches"
				params={{ owner: repo.owner, repo: repo.name }}
				className={cn(ghostPillClassName, "max-sm:hidden")}
			>
				<GitBranchIcon size={14} strokeWidth={2} />
				<span className="tabular-nums">
					{repo.branchCount} {repo.branchCount === 1 ? "branch" : "branches"}
				</span>
			</Link>
			<Link
				to="/$owner/$repo/tags"
				params={{ owner: repo.owner, repo: repo.name }}
				className={cn(ghostPillClassName, "max-sm:hidden")}
			>
				<TagIcon size={14} />
				<span className="tabular-nums">
					{repo.tagCount} {repo.tagCount === 1 ? "tag" : "tags"}
				</span>
			</Link>
			<div className="ml-auto flex items-center gap-1.5">
				<GoToFile repo={repo} currentRef={currentRef} scope={scope} />
				<CodePopover repo={repo} />
			</div>
		</div>
	);
}

export function BranchSelector({
	repo,
	currentRef,
	scope,
	onBranchChange,
	className,
}: {
	repo: RepoOverview;
	currentRef: string;
	scope: GitHubQueryScope;
	onBranchChange: (branch: string) => void;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const branchesOptions = githubRepoBranchesQueryOptions(scope, {
		owner: repo.owner,
		repo: repo.name,
	});

	const branchesQuery = useQuery({
		...branchesOptions,
		enabled: open,
	});

	const prefetchBranches = useCallback(() => {
		void queryClient.prefetchQuery(branchesOptions);
	}, [queryClient, branchesOptions]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					onMouseEnter={prefetchBranches}
					onFocus={prefetchBranches}
					aria-label={`Switch branch, current ${currentRef}`}
					className={cn(pillButtonClassName, className)}
				>
					<GitBranchIcon size={14} strokeWidth={2} />
					<span className="min-w-0 max-w-56 truncate font-mono font-[450]">
						{currentRef}
					</span>
					<ChevronDownIcon
						size={12}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0" align="start">
				<Command>
					<CommandInput placeholder="Find a branch…" />
					<CommandList>
						<CommandEmpty>
							{branchesQuery.isLoading ? "Loading…" : "No branches found."}
						</CommandEmpty>
						{/* Default branch always first */}
						<CommandItem
							key={repo.defaultBranch}
							value={repo.defaultBranch}
							onSelect={(value) => {
								onBranchChange(value);
								setOpen(false);
							}}
							className={cn(
								repo.defaultBranch === currentRef &&
									"font-medium text-foreground",
							)}
						>
							<CheckIcon
								size={14}
								className={cn(
									"shrink-0",
									repo.defaultBranch === currentRef
										? "opacity-100"
										: "opacity-0",
								)}
							/>
							<span className="truncate">{repo.defaultBranch}</span>
							<span className="ml-auto text-xs text-muted-foreground">
								default
							</span>
						</CommandItem>
						{branchesQuery.data
							?.filter((b) => b.name !== repo.defaultBranch)
							.map((branch) => (
								<CommandItem
									key={branch.name}
									value={branch.name}
									onSelect={(value) => {
										onBranchChange(value);
										setOpen(false);
									}}
									className={cn(
										branch.name === currentRef && "font-medium text-foreground",
									)}
								>
									<CheckIcon
										size={14}
										className={cn(
											"shrink-0",
											branch.name === currentRef ? "opacity-100" : "opacity-0",
										)}
									/>
									<span className="truncate">{branch.name}</span>
								</CommandItem>
							))}
					</CommandList>
				</Command>
				<div className="border-t-[0.5px] border-popover-border px-3 py-2">
					<span className="text-xs tabular-nums text-muted-foreground">
						{repo.branchCount} branch{repo.branchCount !== 1 ? "es" : ""}
						{repo.tagCount > 0 && (
							<>
								{" · "}
								{repo.tagCount} tag{repo.tagCount !== 1 ? "s" : ""}
							</>
						)}
					</span>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function CodePopover({ repo }: { repo: RepoOverview }) {
	const [selectedProtocol, setSelectedProtocol] = useRepoCloneProtocol();
	const [copied, setCopied] = useState(false);
	const httpsUrl = `https://github.com/${repo.fullName}.git`;
	const sshUrl = `git@github.com:${repo.fullName}.git`;
	const cliCommand = `gh repo clone ${repo.fullName}`;
	const zipUrl = `https://github.com/${repo.fullName}/archive/refs/heads/${repo.defaultBranch}.zip`;

	const handleProtocolChange = useCallback(
		(protocol: string) => {
			setSelectedProtocol(protocol);
		},
		[setSelectedProtocol],
	);

	const handleCopy = useCallback((text: string) => {
		void navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, []);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(pillButtonClassName, "text-foreground")}
				>
					<CodeIcon size={14} strokeWidth={2} />
					Code
					<ChevronDownIcon
						size={12}
						strokeWidth={2}
						className="text-muted-foreground"
					/>
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[340px] overflow-hidden p-0">
				<div className="flex h-[30px] items-center px-3.5 pt-1.5 text-xs font-medium text-muted-foreground">
					Clone {repo.fullName}
				</div>

				<Tabs
					value={selectedProtocol}
					onValueChange={handleProtocolChange}
					className="gap-0"
				>
					<TabsList className="mx-3.5 mt-1.5 h-7 w-fit">
						<TabsTrigger value="https" className="text-xs">
							HTTPS
						</TabsTrigger>
						<TabsTrigger value="ssh" className="text-xs">
							SSH
						</TabsTrigger>
						<TabsTrigger value="cli" className="text-xs">
							CLI
						</TabsTrigger>
					</TabsList>

					<TabsContent value="https" className="px-3.5 pt-3 pb-3.5">
						<CloneInput
							value={httpsUrl}
							copied={copied}
							onCopy={() => handleCopy(httpsUrl)}
						/>

						<p className="mt-2 text-xs text-muted-foreground">
							Clone using the web URL.
						</p>
					</TabsContent>
					<TabsContent value="ssh" className="px-3.5 pt-3 pb-3.5">
						<CloneInput
							value={sshUrl}
							copied={copied}
							onCopy={() => handleCopy(sshUrl)}
						/>

						<p className="mt-2 text-xs text-muted-foreground">
							Use a password-protected SSH key.
						</p>
					</TabsContent>
					<TabsContent value="cli" className="px-3.5 pt-3 pb-3.5">
						<CloneInput
							value={cliCommand}
							copied={copied}
							onCopy={() => handleCopy(cliCommand)}
						/>
						<p className="mt-2 text-xs text-muted-foreground">
							Work fast with the official CLI.
						</p>
					</TabsContent>
				</Tabs>

				<div className="border-t-[0.5px] border-popover-border p-1.5">
					<a
						href={zipUrl}
						download
						className="flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium text-text-header transition-colors hover:bg-menu-hover hover:text-foreground"
					>
						<DownloadIcon size={14} className="text-muted-foreground" />
						Download ZIP
					</a>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function CloneInput({
	value,
	copied,
	onCopy,
}: {
	value: string;
	copied: boolean;
	onCopy: () => void;
}) {
	return (
		<div className="flex items-center gap-1.5">
			<code className="flex h-8 min-w-0 flex-1 items-center truncate rounded-lg px-2.5 font-mono text-xs text-text-header shadow-field">
				{value}
			</code>
			<button
				type="button"
				className={cn(pillButtonClassName, "h-8 text-[13px]")}
				onClick={onCopy}
			>
				{copied ? (
					<CheckIcon size={14} className="text-success" />
				) : (
					<CopyIcon size={14} />
				)}
				{copied ? "Copied" : "Copy"}
			</button>
		</div>
	);
}

/** Every file and folder of this ref the tree queries have already loaded. */
function useCachedTreeEntries(
	open: boolean,
	repo: RepoOverview,
	currentRef: string,
): FileSearchEntry[] {
	const queryClient = useQueryClient();
	return useMemo(() => {
		if (!open) return [];
		const entries = new Map<string, FileSearchEntry>();
		const cached = queryClient.getQueriesData<RepoTreeEntry[]>({
			predicate: (query) => {
				const [root, , kind, tree, input] = query.queryKey as [
					string,
					unknown,
					string,
					string,
					{ owner?: string; repo?: string; ref?: string } | undefined,
				];
				return (
					root === "github" &&
					kind === "repo" &&
					tree === "tree" &&
					input?.owner === repo.owner &&
					input?.repo === repo.name &&
					input?.ref === currentRef
				);
			},
		});
		for (const [, data] of cached) {
			for (const entry of data ?? []) {
				entries.set(entry.path, {
					path: entry.path,
					name: entry.name,
					type: entry.type,
				});
			}
		}
		return [...entries.values()];
	}, [open, queryClient, repo.owner, repo.name, currentRef]);
}

/**
 * "Go to file": a compact pill field with its T key box that opens a fuzzy
 * search over the files this ref has loaded so far.
 */
function GoToFile({
	repo,
	currentRef,
}: {
	repo: RepoOverview;
	currentRef: string;
	scope: GitHubQueryScope;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);
	const navigate = useNavigate();
	const entries = useCachedTreeEntries(open, repo, currentRef);
	const results = useMemo(
		() =>
			deferredQuery.trim()
				? searchFiles(deferredQuery, entries, 30)
				: entries
						.filter((entry) => entry.type === "file")
						.slice(0, 12)
						.map((entry) => ({ ...entry, score: 0 })),
		[deferredQuery, entries],
	);

	useGlobalShortcuts([
		{
			shortcut: { key: "t" },
			onTrigger: () => setOpen(true),
		},
	]);

	const select = (entry: FileSearchEntry) => {
		setOpen(false);
		setQuery("");
		void navigate({
			to:
				entry.type === "dir" ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$",
			params: {
				owner: repo.owner,
				repo: repo.name,
				_splat: `${currentRef}/${entry.path}`,
			},
		});
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-keyshortcuts="t"
					className={cn(
						pillButtonClassName,
						"w-44 gap-2 font-[450] text-muted-foreground max-md:hidden",
					)}
				>
					<SearchIcon size={14} />
					Go to file
					<KeyHint className="ml-auto">T</KeyHint>
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80 p-0">
				<Command shouldFilter={false}>
					<CommandInput
						value={query}
						onValueChange={setQuery}
						placeholder="Go to file…"
					/>
					<CommandList>
						<CommandEmpty>No files found.</CommandEmpty>
						{results.map((entry) => (
							<CommandItem
								key={entry.path}
								value={entry.path}
								onSelect={() => select(entry)}
							>
								{entry.type === "dir" ? (
									<FolderIcon size={14} className="text-muted-foreground" />
								) : (
									<FileIcon size={14} className="text-muted-foreground" />
								)}
								<span className="truncate">{entry.name}</span>
								{entry.path !== entry.name ? (
									<span className="min-w-0 truncate text-xs text-muted-foreground">
										{entry.path.slice(0, -entry.name.length - 1)}
									</span>
								) : null}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
