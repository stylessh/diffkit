import {
	CheckIcon,
	ChevronDownIcon,
	CodeIcon,
	CopyIcon,
	DownloadIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
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
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@diffkit/ui/components/tabs";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
	type GitHubQueryScope,
	githubRepoBranchesQueryOptions,
} from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";

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
		<div className="flex items-center justify-between gap-3">
			<BranchSelector
				repo={repo}
				currentRef={currentRef}
				scope={scope}
				onBranchChange={onBranchChange}
			/>
			<CodePopover repo={repo} />
		</div>
	);
}

function BranchSelector({
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
				<Button
					variant="secondary"
					size="sm"
					onMouseEnter={prefetchBranches}
					onFocus={prefetchBranches}
					className="max-w-[220px] border border-border dark:border-transparent"
				>
					<GitPullRequestIcon size={14} />
					<span className="truncate">{currentRef}</span>
					<ChevronDownIcon size={14} className="shrink-0 opacity-60" />
				</Button>
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
							<span className="ml-auto text-[10px] text-muted-foreground">
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
				<div className="border-t px-3 py-2">
					<span className="text-xs text-muted-foreground">
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
	const [copied, setCopied] = useState(false);
	const httpsUrl = `https://github.com/${repo.fullName}.git`;
	const sshUrl = `git@github.com:${repo.fullName}.git`;
	const cliCommand = `gh repo clone ${repo.fullName}`;
	const zipUrl = `https://github.com/${repo.fullName}/archive/refs/heads/${repo.defaultBranch}.zip`;

	const handleCopy = useCallback((text: string) => {
		void navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, []);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="default" size="sm">
					<CodeIcon size={14} />
					Code
					<ChevronDownIcon size={14} className="opacity-60" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-96 p-0 overflow-hidden">
				<div className="flex items-center gap-2 border-b px-4 py-3 bg-surface-1">
					<span className="text-sm font-semibold">Clone {repo.fullName}</span>
				</div>

				<Tabs defaultValue="cli" className="gap-0">
					<TabsList className="mx-4 mt-3 h-8 w-fit">
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

					<TabsContent value="https" className="px-4 pb-3 pt-4">
						<CloneInput
							value={httpsUrl}
							copied={copied}
							onCopy={() => handleCopy(httpsUrl)}
						/>

						<p className="mt-1.5 text-xs text-muted-foreground">
							Clone using the web URL.
						</p>
					</TabsContent>
					<TabsContent value="ssh" className="px-4 pb-3 pt-4">
						<CloneInput
							value={sshUrl}
							copied={copied}
							onCopy={() => handleCopy(sshUrl)}
						/>

						<p className="mt-1.5 text-xs text-muted-foreground">
							Use a password-protected SSH key.
						</p>
					</TabsContent>
					<TabsContent value="cli" className="px-4 pb-3 pt-4">
						<CloneInput
							value={cliCommand}
							copied={copied}
							onCopy={() => handleCopy(cliCommand)}
						/>
						<p className="mt-1.5 text-xs text-muted-foreground">
							Work fast with the official CLI.
						</p>
					</TabsContent>
				</Tabs>

				<div className="border-t">
					<a
						href={zipUrl}
						download
						className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-surface-0"
					>
						<DownloadIcon size={15} className="text-muted-foreground" />
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
			<code className="flex-1 truncate rounded-md border bg-surface-0 px-2.5 py-1.5 text-xs">
				{value}
			</code>
			<Button
				variant="ghost"
				size="icon"
				className="size-7 shrink-0"
				onClick={onCopy}
			>
				{copied ? (
					<CheckIcon size={14} className="text-green-500" />
				) : (
					<CopyIcon size={14} />
				)}
			</Button>
		</div>
	);
}
