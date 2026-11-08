import { useCallback, useEffect, useRef, useState } from "react";
import {
	formatLineHash,
	type LineRange,
	parseLineHash,
	selectLine,
} from "#/lib/code-browsing/line-range";

function currentHashRange(lineCount: number) {
	if (typeof window === "undefined") return null;
	return parseLineHash(window.location.hash, lineCount);
}

function writeHash(range: LineRange | null) {
	const hash = formatLineHash(range);
	if (window.location.hash === hash) return;
	window.history.replaceState(
		window.history.state,
		"",
		`${window.location.pathname}${window.location.search}${hash}`,
	);
}

export function scrollLineIntoView(line: number) {
	document
		.getElementById(`L${line}`)
		?.scrollIntoView({ block: "center", behavior: "auto" });
}

export function useLineSelection(lineCount: number) {
	const [range, setRange] = useState(() => currentHashRange(lineCount));
	const rangeRef = useRef(range);
	rangeRef.current = range;

	useEffect(() => {
		const initial = currentHashRange(lineCount);
		if (initial) scrollLineIntoView(initial.start);
		const onHashChange = () => {
			const next = currentHashRange(lineCount);
			setRange(next);
			if (next) scrollLineIntoView(next.start);
		};
		window.addEventListener("hashchange", onHashChange);
		return () => window.removeEventListener("hashchange", onHashChange);
	}, [lineCount]);

	const select = useCallback((line: number, extend: boolean) => {
		const next = selectLine(rangeRef.current, line, extend);
		setRange(next);
		writeHash(next);
	}, []);

	return { range, select };
}
