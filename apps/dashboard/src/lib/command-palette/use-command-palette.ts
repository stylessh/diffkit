import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getRegisteredCommands } from "./registry";

const CHORD_TIMEOUT_MS = 800;

function isEditableTarget(e: KeyboardEvent) {
	const tag = (e.target as HTMLElement)?.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	if ((e.target as HTMLElement)?.isContentEditable) return true;
	return false;
}

export function useCommandPalette() {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const chordRef = useRef<string[]>([]);
	const chordTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		function resetChord() {
			chordRef.current = [];
			clearTimeout(chordTimerRef.current);
		}

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				resetChord();
				setOpen((prev) => !prev);
				return;
			}

			if (open || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e)) {
				return;
			}

			const key = e.key.toUpperCase();
			if (key.length !== 1 || !/[A-Z]/.test(key)) {
				resetChord();
				return;
			}

			chordRef.current = [...chordRef.current, key];
			clearTimeout(chordTimerRef.current);
			chordTimerRef.current = setTimeout(resetChord, CHORD_TIMEOUT_MS);

			const pressed = chordRef.current;
			const commands = getRegisteredCommands();

			for (const cmd of commands) {
				if (!cmd.shortcut) continue;
				const shortcut = cmd.shortcut.map((k) => k.toUpperCase());

				if (shortcut.length !== pressed.length) continue;
				if (!shortcut.every((k, i) => k === pressed[i])) continue;

				e.preventDefault();
				resetChord();

				if (cmd.action.type === "navigate") {
					void router.navigate({ to: cmd.action.to });
				} else {
					void cmd.action.fn();
				}
				return;
			}
		}

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			clearTimeout(chordTimerRef.current);
		};
	}, [open, router]);

	const close = useCallback(() => setOpen(false), []);

	return { open, setOpen, close };
}
