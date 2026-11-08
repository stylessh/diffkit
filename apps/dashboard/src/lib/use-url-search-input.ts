import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "./use-debounced-value";

/**
 * Text input mirrored into a URL search param with a debounce. Typing writes
 * to the URL after `delayMs`; URL changes from elsewhere (nav links, Back,
 * "clear filters") flow back into the input instead of being overwritten.
 */
export function useUrlSearchInput(
	urlValue: string | null,
	apply: (next: string | null) => void,
	delayMs = 300,
) {
	const [input, setInput] = useState(urlValue ?? "");
	const debounced = useDebouncedValue(input, delayMs);
	const lastSynced = useRef((urlValue ?? "").trim());
	const applyRef = useRef(apply);
	useEffect(() => {
		applyRef.current = apply;
	}, [apply]);

	// URL → input, only for changes we didn't make.
	useEffect(() => {
		const value = (urlValue ?? "").trim();
		if (value === lastSynced.current) return;
		lastSynced.current = value;
		setInput(value);
	}, [urlValue]);

	// Debounced input → URL, only when the typed value actually changed.
	useEffect(() => {
		const next = debounced.trim();
		if (next === lastSynced.current) return;
		lastSynced.current = next;
		applyRef.current(next || null);
	}, [debounced]);

	return [input, setInput] as const;
}
