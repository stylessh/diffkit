import { useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useGlobalShortcuts } from "#/lib/shortcuts";
import { getRegisteredCommands } from "./registry";

export function useCommandPalette() {
	const [open, setOpen] = useState(false);
	const router = useRouter();

	useGlobalShortcuts([
		{
			shortcut: { key: "k", mod: true },
			allowInEditable: true,
			onTrigger: () => {
				setOpen((prev) => !prev);
			},
		},
		...getRegisteredCommands().flatMap((cmd) => {
			if (!cmd.shortcut) return [];
			return [
				{
					shortcut: cmd.shortcut.map((key) => ({ key })),
					enabled: !open,
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

	const close = useCallback(() => setOpen(false), []);

	return { open, setOpen, close };
}
