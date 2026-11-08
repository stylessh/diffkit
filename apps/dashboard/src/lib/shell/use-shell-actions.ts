import { useParams, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import {
	type CreateActionId,
	createActionPath,
	type NewPullEntry,
	resolveCreateTarget,
} from "./create-actions";
import {
	closeShellOverlay,
	openRepoPicker,
	type RepoPickerIntent,
} from "./shell-overlay";
import {
	type RepoRef,
	updateWorkspaceRepos,
	withPinToggled,
	withRecentRepo,
} from "./workspace-repos";

export function useCurrentRepo(): RepoRef | null {
	const params = useParams({ strict: false }) as {
		owner?: string;
		repo?: string;
	};
	const { owner, repo } = params;
	return useMemo(
		() => (owner && repo ? { owner, name: repo } : null),
		[owner, repo],
	);
}

function useNewPullEntry(): NewPullEntry {
	const router = useRouter();
	const routesByPath = router.routesByPath as unknown as Record<
		string,
		unknown
	>;
	return routesByPath["/$owner/$repo/compare"] ||
		routesByPath["/$owner/$repo/compare/"]
		? "compare"
		: "branches";
}

export function useStartCreateAction() {
	const router = useRouter();
	const currentRepo = useCurrentRepo();
	const newPullEntry = useNewPullEntry();

	return useCallback(
		(id: CreateActionId) => {
			const target = resolveCreateTarget(id, currentRepo, newPullEntry);
			if (target.kind === "navigate") {
				closeShellOverlay();
				void router.navigate({ to: target.to });
				return;
			}
			openRepoPicker({ kind: "create", action: target.action });
		},
		[router, currentRepo, newPullEntry],
	);
}

export function useCompleteRepoPick(userId: string) {
	const router = useRouter();
	const newPullEntry = useNewPullEntry();

	return useCallback(
		(intent: RepoPickerIntent, repo: RepoRef) => {
			closeShellOverlay();
			switch (intent.kind) {
				case "open":
					void router.navigate({ to: `/${repo.owner}/${repo.name}` });
					return;
				case "pin":
					updateWorkspaceRepos(userId, (state) => withPinToggled(state, repo));
					return;
				case "create":
					void router.navigate({
						to: createActionPath(intent.action, repo, newPullEntry),
					});
					return;
			}
		},
		[router, userId, newPullEntry],
	);
}

export function useRecordRecentRepo(userId: string) {
	const currentRepo = useCurrentRepo();
	useEffect(() => {
		if (!currentRepo) return;
		updateWorkspaceRepos(userId, (state) => withRecentRepo(state, currentRepo));
	}, [userId, currentRepo]);
}
