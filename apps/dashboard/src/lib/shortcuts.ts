import { useEffect, useEffectEvent, useRef } from "react";

type KeyboardEventSource = Pick<
	KeyboardEvent,
	"altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export type ShortcutStep = {
	key?: string;
	code?: string;
	shift?: boolean;
	alt?: boolean;
	ctrl?: boolean;
	meta?: boolean;
	mod?: boolean;
};

export type ShortcutDefinition = {
	shortcut: ShortcutStep | ShortcutStep[];
	onTrigger: (event: KeyboardEvent) => void;
	enabled?: boolean;
	allowInEditable?: boolean;
	preventDefault?: boolean;
	stopPropagation?: boolean;
};

const SEQUENCE_TIMEOUT_MS = 800;

type KeyboardEventSnapshot = KeyboardEventSource;

function normalizeShortcut(shortcut: ShortcutDefinition["shortcut"]) {
	return Array.isArray(shortcut) ? shortcut : [shortcut];
}

function toSnapshot(event: KeyboardEvent): KeyboardEventSnapshot {
	return {
		key: event.key,
		code: event.code,
		shiftKey: event.shiftKey,
		altKey: event.altKey,
		ctrlKey: event.ctrlKey,
		metaKey: event.metaKey,
	};
}

export function isEditableKeyboardTarget(target: EventTarget | null) {
	const element = target as HTMLElement | null;
	const tag = element?.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	return element?.isContentEditable ?? false;
}

export function matchesShortcut(
	event: KeyboardEventSource,
	shortcut: ShortcutStep,
) {
	if (shortcut.key && event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
		return false;
	}

	if (shortcut.code && event.code !== shortcut.code) {
		return false;
	}

	if (event.shiftKey !== (shortcut.shift ?? false)) {
		return false;
	}

	if (event.altKey !== (shortcut.alt ?? false)) {
		return false;
	}

	if (shortcut.mod != null) {
		if ((event.metaKey || event.ctrlKey) !== shortcut.mod) {
			return false;
		}
	} else {
		if (event.metaKey !== (shortcut.meta ?? false)) {
			return false;
		}

		if (event.ctrlKey !== (shortcut.ctrl ?? false)) {
			return false;
		}
	}

	return true;
}

function sequenceStartsWith(
	events: KeyboardEventSnapshot[],
	shortcut: ShortcutStep[],
) {
	if (events.length > shortcut.length) return false;
	return events.every((event, index) =>
		matchesShortcut(event, shortcut[index]),
	);
}

function findMatchingShortcut(
	shortcuts: ShortcutDefinition[],
	event: KeyboardEvent,
	editable: boolean,
) {
	for (const definition of shortcuts) {
		if (definition.enabled === false) continue;
		if (editable && !definition.allowInEditable) continue;
		const steps = normalizeShortcut(definition.shortcut);
		if (steps.length !== 1) continue;
		if (matchesShortcut(event, steps[0])) {
			return definition;
		}
	}

	return null;
}

function findMatchingSequence(
	shortcuts: ShortcutDefinition[],
	events: KeyboardEventSnapshot[],
	editable: boolean,
) {
	for (const definition of shortcuts) {
		if (definition.enabled === false) continue;
		if (editable && !definition.allowInEditable) continue;
		const steps = normalizeShortcut(definition.shortcut);
		if (steps.length <= 1) continue;
		if (events.length !== steps.length) continue;
		if (sequenceStartsWith(events, steps)) {
			return definition;
		}
	}

	return null;
}

function hasSequencePrefix(
	shortcuts: ShortcutDefinition[],
	events: KeyboardEventSnapshot[],
	editable: boolean,
) {
	for (const definition of shortcuts) {
		if (definition.enabled === false) continue;
		if (editable && !definition.allowInEditable) continue;
		const steps = normalizeShortcut(definition.shortcut);
		if (steps.length <= 1) continue;
		if (sequenceStartsWith(events, steps)) {
			return true;
		}
	}

	return false;
}

export function useGlobalShortcuts(shortcuts: ShortcutDefinition[]) {
	const sequenceRef = useRef<KeyboardEventSnapshot[]>([]);
	const sequenceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const resetSequence = useEffectEvent(() => {
		sequenceRef.current = [];
		clearTimeout(sequenceTimerRef.current);
	});

	const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
		const editable = isEditableKeyboardTarget(event.target);
		const singleShortcut = findMatchingShortcut(shortcuts, event, editable);

		if (singleShortcut) {
			if (singleShortcut.preventDefault !== false) {
				event.preventDefault();
			}
			if (singleShortcut.stopPropagation) {
				event.stopPropagation();
			}
			resetSequence();
			singleShortcut.onTrigger(event);
			return;
		}

		const sequenceShortcuts = shortcuts.filter(
			(definition) =>
				definition.enabled !== false &&
				normalizeShortcut(definition.shortcut).length > 1,
		);
		if (sequenceShortcuts.length === 0) {
			resetSequence();
			return;
		}

		const nextEvent = toSnapshot(event);
		const nextSequence = [...sequenceRef.current, nextEvent];

		clearTimeout(sequenceTimerRef.current);

		const matchedSequence = findMatchingSequence(
			sequenceShortcuts,
			nextSequence,
			editable,
		);
		if (matchedSequence) {
			if (matchedSequence.preventDefault !== false) {
				event.preventDefault();
			}
			if (matchedSequence.stopPropagation) {
				event.stopPropagation();
			}
			resetSequence();
			matchedSequence.onTrigger(event);
			return;
		}

		if (hasSequencePrefix(sequenceShortcuts, nextSequence, editable)) {
			sequenceRef.current = nextSequence;
			sequenceTimerRef.current = setTimeout(resetSequence, SEQUENCE_TIMEOUT_MS);
			return;
		}

		const fallbackSequence = [nextEvent];
		if (hasSequencePrefix(sequenceShortcuts, fallbackSequence, editable)) {
			sequenceRef.current = fallbackSequence;
			sequenceTimerRef.current = setTimeout(resetSequence, SEQUENCE_TIMEOUT_MS);
			return;
		}

		resetSequence();
	});

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			clearTimeout(sequenceTimerRef.current);
		};
	}, []);
}
