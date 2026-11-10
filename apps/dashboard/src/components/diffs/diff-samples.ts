import type { DiffFileSummary } from "#/lib/diffs/diff-files";

export type SampleDiffFile = DiffFileSummary & { lines: readonly string[] };

const file = (
	path: string,
	status: DiffFileSummary["status"],
	additions: number,
	deletions: number,
	lines: readonly string[],
): SampleDiffFile => ({
	path,
	previousPath: null,
	status,
	additions,
	deletions,
	content: "hunks",
	lines,
});

export const SAMPLE_DIFF_FILES: readonly SampleDiffFile[] = [
	file("src/components/review/thread-shortcuts.ts", "modified", 24, 7, [
		'import { useEffect } from "react";',
		'import { focusThread } from "./thread-focus";',
		"",
		"export function useThreadShortcuts(threads: Thread[]) {",
		"  useEffect(() => {",
		"    const onKeyDown = (event: KeyboardEvent) => {",
		"      if (isTyping(event.target)) return;",
		'      if (event.key === "j") focusThread(nextUnresolved(threads));',
		'      if (event.key === "k") focusThread(previousUnresolved(threads));',
		"    };",
		'    window.addEventListener("keydown", onKeyDown);',
		'    return () => window.removeEventListener("keydown", onKeyDown);',
		"  }, [threads]);",
		"}",
	]),
	file("src/components/review/thread-focus.ts", "added", 31, 0, [
		"export function focusThread(thread: Thread | undefined) {",
		"  if (!thread) return;",
		"  const element = document.getElementById(threadAnchor(thread));",
		'  element?.scrollIntoView({ block: "center" });',
		"  element?.focus({ preventScroll: true });",
		"}",
		"",
		"export function nextUnresolved(threads: Thread[]) {",
		"  const from = threads.findIndex(isFocused);",
		"  return threads.slice(from + 1).find((thread) => !thread.isResolved);",
		"}",
	]),
	file("src/lib/keyboard/is-typing.ts", "modified", 9, 4, [
		"export function isTyping(target: EventTarget | null) {",
		"  if (!(target instanceof HTMLElement)) return false;",
		"  if (target.isContentEditable) return true;",
		'  return target.matches("input, textarea, select");',
		"}",
		"",
		"export function isModifierHeld(event: KeyboardEvent) {",
		"  return event.metaKey || event.ctrlKey || event.altKey;",
		"}",
	]),
	file("docs/keyboard-shortcuts.md", "modified", 12, 2, [
		"## Review threads",
		"",
		"| Key | Action |",
		"| --- | --- |",
		"| `j` | Next unresolved thread |",
		"| `k` | Previous unresolved thread |",
		"| `r` | Reply to the focused thread |",
		"",
		"Shortcuts stay out of the way while a comment is being written.",
	]),
];
