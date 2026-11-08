import {
	CheckIcon,
	ChevronDownIcon,
	CodeIcon,
	CopyIcon,
	DownloadIcon,
	GitBranchIcon,
} from "@diffkit/icons";
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
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { RepoRefPicker } from "#/components/repo/refs/repo-ref-picker";
import { TagIcon } from "#/components/repo/refs/tag-icon";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";
import { useRepoCloneProtocol } from "#/lib/repo-clone-protocol-storage";
import { FileFinder } from "./code/file-finder";
import { ghostPillClassName, pillButtonClassName } from "./repo-ui";

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
			<RepoRefPicker
				owner={repo.owner}
				repo={repo.name}
				scope={scope}
				currentRef={currentRef}
				defaultBranch={repo.defaultBranch}
				onSelect={onBranchChange}
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
				<FileFinder
					scope={scope}
					owner={repo.owner}
					repo={repo.name}
					currentRef={currentRef}
				/>
				<Link
					to="/$owner/$repo/search"
					params={{ owner: repo.owner, repo: repo.name }}
					aria-label="Search code"
					className={cn(ghostPillClassName, "max-lg:hidden")}
				>
					<CodeIcon size={14} />
					Search
				</Link>
				<CodePopover repo={repo} />
			</div>
		</div>
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
