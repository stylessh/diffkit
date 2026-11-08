import { ArrowLeftRightIcon, PinIcon } from "@diffkit/icons";
import { CREATE_ACTIONS } from "#/lib/shell/create-actions";
import { openRepoPicker } from "#/lib/shell/shell-overlay";
import {
	useCurrentRepo,
	useStartCreateAction,
} from "#/lib/shell/use-shell-actions";
import {
	canPinMoreRepos,
	isRepoPinned,
	repoFullName,
	updateWorkspaceRepos,
	useWorkspaceRepos,
	withoutPinnedRepo,
	withPinnedRepo,
} from "#/lib/shell/workspace-repos";
import type { CommandItem } from "./types";

export function useShellCommandItems(userId: string): CommandItem[] {
	const currentRepo = useCurrentRepo();
	const workspace = useWorkspaceRepos(userId);
	const startCreateAction = useStartCreateAction();

	const createItems: CommandItem[] = CREATE_ACTIONS.map((action) => ({
		id: `create:${action.id}`,
		label: currentRepo
			? `${action.label} in ${repoFullName(currentRepo)}`
			: `${action.label}…`,
		group: "Create",
		icon: action.icon,
		keywords: action.keywords,
		shortcut: action.keys,
		action: { type: "execute", fn: () => startCreateAction(action.id) },
	}));

	const repoItems: CommandItem[] = [
		{
			id: "repo:switch",
			label: "Switch repository…",
			group: "Repositories",
			icon: ArrowLeftRightIcon,
			keywords: ["open", "jump", "go to", "repo"],
			shortcut: ["O", "R"],
			action: { type: "execute", fn: () => openRepoPicker({ kind: "open" }) },
		},
	];

	if (currentRepo && isRepoPinned(workspace, currentRepo)) {
		repoItems.push({
			id: "repo:unpin-current",
			label: `Unpin ${repoFullName(currentRepo)} from the sidebar`,
			group: "Repositories",
			icon: PinIcon,
			keywords: ["unpin", "remove", "quick access", "favorite"],
			action: {
				type: "execute",
				fn: () =>
					updateWorkspaceRepos(userId, (state) =>
						withoutPinnedRepo(state, currentRepo),
					),
			},
		});
	} else if (currentRepo && canPinMoreRepos(workspace)) {
		repoItems.push({
			id: "repo:pin-current",
			label: `Pin ${repoFullName(currentRepo)} to the sidebar`,
			group: "Repositories",
			icon: PinIcon,
			keywords: ["pin", "quick access", "favorite"],
			action: {
				type: "execute",
				fn: () =>
					updateWorkspaceRepos(userId, (state) =>
						withPinnedRepo(state, currentRepo),
					),
			},
		});
	} else if (!currentRepo && canPinMoreRepos(workspace)) {
		repoItems.push({
			id: "repo:pin",
			label: "Pin a repository…",
			group: "Repositories",
			icon: PinIcon,
			keywords: ["pin", "quick access", "favorite", "sidebar"],
			action: { type: "execute", fn: () => openRepoPicker({ kind: "pin" }) },
		});
	}

	return [...createItems, ...repoItems];
}
