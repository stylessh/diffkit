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
import { useMemo, useState } from "react";
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
			return "Pin a repository";
		case "create":
			return `${createActionLabel(intent.action)} in…`;
	}
}

function pickerPlaceholder(intent: RepoPickerIntent) {
	switch (intent.kind) {
		case "open":
			return "Switch to repository…";
		case "pin":
			return "Pin which repository?";
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
	workspace: WorkspaceRepos,
	repos: UserRepoSummary[] | undefined,
) {
	const recentNames = new Set(
		workspace.recent.map((repo) => repoFullName(repo).toLowerCase()),
	);
	const all = (repos ?? [])
		.filter((repo) => !recentNames.has(repo.fullName.toLowerCase()))
		.map(toRow);
	return { recent: workspace.recent as PickerRow[], all };
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
	return (
		<CommandItem
			value={fullName}
			keywords={[repo.owner, repo.name]}
			disabled={pinned}
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
		</CommandItem>
	);
}

export function RepoPickerDialog() {
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
		() => splitRows(workspace, reposQuery.data),
		[workspace, reposQuery.data],
	);
	const pinsFull = intent.kind === "pin" && !canPinMoreRepos(workspace);
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
				{pinsFull ? (
					<p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
						Unpin a repository first: the sidebar holds up to 12.
					</p>
				) : (
					<>
						<CommandEmpty>{emptyMessage(reposQuery.status)}</CommandEmpty>
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
					</>
				)}
			</CommandList>
		</CommandDialog>
	);
}
