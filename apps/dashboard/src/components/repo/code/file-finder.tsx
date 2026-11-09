import { CodeIcon, SearchIcon } from "@diffkit/icons";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@diffkit/ui/components/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@diffkit/ui/components/dialog";
import { cn } from "@diffkit/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import { FileTypeIcon } from "#/components/shared/file-type-icon";
import { type FileSearchEntry, searchFiles } from "#/lib/fuzzy-file-search";
import type { GitHubQueryScope } from "#/lib/github.query";
import { useGlobalShortcuts } from "#/lib/shortcuts";
import { iconButtonClassName, KeyHint, pillButtonClassName } from "../repo-ui";
import { useTreeIndex } from "./use-directory-listing";

const RESULT_LIMIT = 50;
const IDLE_SUGGESTIONS = 12;

type FileFinderProps = {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	currentRef: string;
};

export function FileFinder({
	scope,
	owner,
	repo,
	currentRef,
}: FileFinderProps) {
	const [open, setOpen] = useState(false);
	useGlobalShortcuts([
		{ shortcut: { key: "t" }, onTrigger: () => setOpen(true) },
	]);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label="Go to file"
				aria-keyshortcuts="t"
				className={cn(iconButtonClassName, "md:hidden")}
			>
				<SearchIcon size={15} />
			</button>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-keyshortcuts="t"
				className={cn(
					pillButtonClassName,
					"w-36 gap-2 font-[450] text-muted-foreground max-md:hidden",
				)}
			>
				<SearchIcon size={14} />
				Go to file
				<KeyHint className="ml-auto">T</KeyHint>
			</button>
			<Dialog open={open} onOpenChange={setOpen}>
				{open ? (
					<FileFinderDialog
						scope={scope}
						owner={owner}
						repo={repo}
						currentRef={currentRef}
						onDone={() => setOpen(false)}
					/>
				) : null}
			</Dialog>
		</>
	);
}

function FileFinderDialog({
	scope,
	owner,
	repo,
	currentRef,
	onDone,
}: FileFinderProps & { onDone: () => void }) {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);
	const indexQuery = useTreeIndex(scope, { owner, repo, ref: currentRef });
	const index = indexQuery.data;

	const results = useMemo((): FileSearchEntry[] => {
		const entries = index?.finderEntries ?? [];
		if (deferredQuery.trim()) {
			return searchFiles(deferredQuery, entries, RESULT_LIMIT);
		}
		return entries
			.filter((entry) => entry.type === "file")
			.slice(0, IDLE_SUGGESTIONS);
	}, [deferredQuery, index]);

	const [highlighted, setHighlighted] = useState("");
	const activeValue = results.some((entry) => entry.path === highlighted)
		? highlighted
		: (results[0]?.path ?? "");

	const open = (entry: FileSearchEntry) => {
		onDone();
		void navigate({
			to:
				entry.type === "dir" ? "/$owner/$repo/tree/$" : "/$owner/$repo/blob/$",
			params: { owner, repo, _splat: `${currentRef}/${entry.path}` },
		});
	};

	const searchCode = () => {
		onDone();
		void navigate({
			to: "/$owner/$repo/search",
			params: { owner, repo },
			search: { q: query.trim() },
		});
	};

	return (
		<DialogContent
			showCloseButton={false}
			className="top-[18%] translate-y-0 gap-0 p-0 sm:max-w-xl"
		>
			<DialogTitle className="sr-only">Go to file</DialogTitle>
			<DialogDescription className="sr-only">
				Search files in {owner}/{repo} at {currentRef}
			</DialogDescription>
			<Command
				shouldFilter={false}
				value={activeValue}
				onValueChange={setHighlighted}
				className="bg-transparent"
			>
				<CommandInput
					value={query}
					onValueChange={setQuery}
					placeholder={`Go to file in ${repo}…`}
					className="h-11"
				/>
				<CommandList className="max-h-[min(420px,60dvh)] p-1">
					<CommandEmpty>
						{indexQuery.status === "pending"
							? "Loading files…"
							: indexQuery.status === "error"
								? "Couldn't load the file list."
								: "No matching files."}
					</CommandEmpty>
					{results.map((entry) => (
						<CommandItem
							key={entry.path}
							value={entry.path}
							onSelect={() => open(entry)}
							className="gap-2"
						>
							<FileTypeIcon
								path={entry.path}
								kind={entry.type === "dir" ? "directory" : "file"}
								size={14}
							/>
							<span className="shrink-0 truncate text-foreground">
								{entry.name}
							</span>
							{entry.path !== entry.name ? (
								<span className="min-w-0 truncate text-xs text-muted-foreground">
									{entry.path.slice(0, -entry.name.length - 1)}
								</span>
							) : null}
						</CommandItem>
					))}
					{deferredQuery.trim() ? (
						<CommandItem
							value={`search-code:${deferredQuery}`}
							onSelect={searchCode}
							className="gap-2 text-muted-foreground"
						>
							<CodeIcon size={14} className="shrink-0" />
							Search code for “{deferredQuery.trim()}”
						</CommandItem>
					) : null}
				</CommandList>
				{index?.truncated ? (
					<p className="border-t-[0.5px] border-popover-border px-3 py-2 text-xs text-muted-foreground">
						This repository is large; only the first{" "}
						{index.finderEntries.length.toLocaleString()} paths are searchable.
					</p>
				) : null}
			</Command>
		</DialogContent>
	);
}
