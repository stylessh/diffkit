import { useRouter } from "@tanstack/react-router";
import {
	closeShellOverlay,
	openCommandPalette,
	toggleCommandPalette,
	useShellOverlay,
} from "#/lib/shell/shell-overlay";
import { useGlobalShortcuts } from "#/lib/shortcuts";
import { getRegisteredCommands } from "./registry";

export function useCommandPalette() {
	const overlay = useShellOverlay();
	const router = useRouter();
	const open = overlay.kind === "command-palette";

	useGlobalShortcuts([
		{
			shortcut: { key: "k", mod: true },
			allowInEditable: true,
			onTrigger: toggleCommandPalette,
		},
		...getRegisteredCommands().flatMap((cmd) => {
			if (!cmd.shortcut) return [];
			return [
				{
					shortcut: cmd.shortcut.map((key) => ({ key })),
					enabled: overlay.kind === "none",
					onTrigger: () => {
						if (cmd.action.type === "navigate") {
							void router.navigate({ to: cmd.action.to });
						} else {
							void cmd.action.fn();
						}
					},
				},
			];
		}),
	]);

	const setOpen = (nextOpen: boolean) =>
		nextOpen ? openCommandPalette() : closeShellOverlay();

	return { open, setOpen, close: closeShellOverlay };
}
