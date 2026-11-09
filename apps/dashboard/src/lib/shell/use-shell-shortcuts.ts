import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { githubViewerQueryOptions } from "#/lib/github.query";
import { type ShortcutDefinition, useGlobalShortcuts } from "#/lib/shortcuts";
import { useHasMounted } from "#/lib/use-has-mounted";
import { CREATE_ACTIONS } from "./create-actions";
import { openRepoPicker, useShellOverlay } from "./shell-overlay";
import { useStartCreateAction } from "./use-shell-actions";

export function useShellShortcuts({ userId }: { userId: string }) {
	const router = useRouter();
	const hasMounted = useHasMounted();
	const overlay = useShellOverlay();
	const startCreateAction = useStartCreateAction();
	const viewerQuery = useQuery({
		...githubViewerQueryOptions({ userId }),
		enabled: hasMounted,
	});
	const viewerLogin = viewerQuery.data?.login;
	const idle = overlay.kind === "none";

	const shortcuts: ShortcutDefinition[] = [
		{
			shortcut: [{ key: "o" }, { key: "r" }],
			enabled: idle,
			onTrigger: () => openRepoPicker({ kind: "open" }),
		},
		{
			shortcut: [{ key: "g" }, { key: "u" }],
			enabled: idle && Boolean(viewerLogin),
			onTrigger: () => {
				void router.navigate({
					to: "/$owner",
					params: { owner: viewerLogin ?? "" },
				});
			},
		},
		...CREATE_ACTIONS.map((action) => ({
			shortcut: action.keys.map((key) => ({ key })),
			enabled: idle,
			onTrigger: () => startCreateAction(action.id),
		})),
	];

	useGlobalShortcuts(shortcuts);
}
