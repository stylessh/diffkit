import { CheckIcon, LockIcon, RepoIcon } from "@diffkit/icons";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@diffkit/ui/components/command";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { memo, useMemo, useState } from "react";
import { githubUserReposQueryOptions } from "#/lib/github.query";
import type { UserRepoSummary } from "#/lib/github.types";
import {
	CREATE_ACTIONS,
	type CreateActionId,
} from "#/lib/shell/create-actions";
import {
	closeShellOverlay,
	type RepoPickerIntent,
	useShellOverlay,
} from "#/lib/shell/shell-overlay";
import { useCompleteRepoPick } from "#/lib/shell/use-shell-actions";
import {
	canPinMoreRepos,
	isRepoPinned,
	MAX_PINNED_REPOS,
	type RepoRef,
	repoFullName,
	useWorkspaceRepos,
	type WorkspaceRepos,
} from "#/lib/shell/workspace-repos";

const routeApi = getRouteApi("/_protected");

function createActionLabel(id: CreateActionId) {
	return CREATE_ACTIONS.find((action) => action.id === id)?.label ?? "Create";
}

function pickerTitle(intent: RepoPickerIntent) {
	switch (intent.kind) {
		case "open":
			return "Switch repository";
		case "pin":
			return "Pin or unpin a repository";
		case "create":
			return `${createActionLabel(intent.action)} in…`;
	}
}

function pickerPlaceholder(intent: RepoPickerIntent) {
	switch (intent.kind) {
		case "open":
			return "Switch to repository…";
		case "pin":
			return "Pin or unpin which repository?";
		case "create":
			return `${createActionLabel(intent.action)} in which repository?`;
	}
}

function emptyMessage(status: "pending" | "error" | "success") {
	switch (status) {
		case "pending":
			return "Loading repositories…";
		case "error":
			return "Couldn't load your repositories.";
		case "success":
			return "No repositories match.";
	}
}

type PickerRow = RepoRef & { isPrivate?: boolean };

function toRow(repo: UserRepoSummary): PickerRow {
	return { owner: repo.owner, name: repo.name, isPrivate: repo.isPrivate };
}

function splitRows(
	intent: RepoPickerIntent,
	workspace: WorkspaceRepos,
	repos: UserRepoSummary[] | undefined,
) {
	const listedAbove = intent.kind === "create" ? [] : workspace.pinned;
	const aboveNames = new Set(
		listedAbove.map((repo) => repoFullName(repo).toLowerCase()),
	);
	const recent = workspace.recent.filter(
		(repo) => !aboveNames.has(repoFullName(repo).toLowerCase()),
	);
	for (const repo of recent) aboveNames.add(repoFullName(repo).toLowerCase());
	const all = (repos ?? [])
		.filter((repo) => !aboveNames.has(repo.fullName.toLowerCase()))
		.map(toRow);
	return { recent: recent as PickerRow[], all };
}

function RepoRow({
	repo,
	intent,
	workspace,
	onPick,
}: {
	repo: PickerRow;
	intent: RepoPickerIntent;
	workspace: WorkspaceRepos;
	onPick: (repo: RepoRef) => void;
}) {
	const fullName = repoFullName(repo);
	const pinned = intent.kind === "pin" && isRepoPinned(workspace, repo);
	const pinsFull = intent.kind === "pin" && !canPinMoreRepos(workspace);
	return (
		<CommandItem
			value={fullName}
			keywords={[repo.owner, repo.name]}
			disabled={pinsFull && !pinned}
			onSelect={() => onPick(repo)}
		>
			<RepoIcon className="size-4 shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1 truncate">
				<span className="text-muted-foreground">{repo.owner}/</span>
				{repo.name}
			</span>
			{repo.isPrivate ? (
				<LockIcon className="size-3.5 shrink-0 text-muted-foreground" />
			) : null}
			{pinned ? (
				<span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
					<CheckIcon className="size-3.5" />
					Pinned
				</span>
			) : null}
			{pinsFull && !pinned ? (
				<span className="shrink-0 text-[11px] text-muted-foreground">
					{MAX_PINNED_REPOS} pinned
				</span>
			) : null}
		</CommandItem>
	);
}

export const RepoPickerDialog = memo(function RepoPickerDialog() {
	const overlay = useShellOverlay();
	const { user } = routeApi.useRouteContext();
	const workspace = useWorkspaceRepos(user.id);
	const completeRepoPick = useCompleteRepoPick(user.id);
	const [search, setSearch] = useState("");
	const open = overlay.kind === "repo-picker";
	const [lastIntent, setLastIntent] = useState<RepoPickerIntent>({
		kind: "open",
	});
	if (open && overlay.intent !== lastIntent) {
		setLastIntent(overlay.intent);
	}
	const intent = open ? overlay.intent : lastIntent;

	const reposQuery = useQuery({
		...githubUserReposQueryOptions({ userId: user.id }),
		enabled: open,
	});
	const rows = useMemo(
		() => splitRows(intent, workspace, reposQuery.data),
		[intent, workspace, reposQuery.data],
	);
	const title = pickerTitle(intent);

	const pick = (repo: RepoRef) => {
		setSearch("");
		completeRepoPick(intent, repo);
	};

	return (
		<CommandDialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (nextOpen) return;
				setSearch("");
				closeShellOverlay();
			}}
			title={title}
			description="Search the repositories you can access."
		>
			<CommandInput
				placeholder={pickerPlaceholder(intent)}
				value={search}
				onValueChange={setSearch}
			/>
			<CommandList>
				<CommandEmpty>{emptyMessage(reposQuery.status)}</CommandEmpty>
				{intent.kind !== "create" && workspace.pinned.length > 0 ? (
					<CommandGroup
						heading={
							intent.kind === "pin" ? "Pinned · select to unpin" : "Pinned"
						}
					>
						{workspace.pinned.map((repo) => (
							<RepoRow
								key={repoFullName(repo)}
								repo={repo}
								intent={intent}
								workspace={workspace}
								onPick={pick}
							/>
						))}
					</CommandGroup>
				) : null}
				{rows.recent.length > 0 ? (
					<CommandGroup heading="Recent">
						{rows.recent.map((repo) => (
							<RepoRow
								key={repoFullName(repo)}
								repo={repo}
								intent={intent}
								workspace={workspace}
								onPick={pick}
							/>
						))}
					</CommandGroup>
				) : null}
				{rows.all.length > 0 ? (
					<CommandGroup heading="Your repositories">
						{rows.all.map((repo) => (
							<RepoRow
								key={repoFullName(repo)}
								repo={repo}
								intent={intent}
								workspace={workspace}
								onPick={pick}
							/>
						))}
					</CommandGroup>
				) : null}
			</CommandList>
		</CommandDialog>
	);
});
