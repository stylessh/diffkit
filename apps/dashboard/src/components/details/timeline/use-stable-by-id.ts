import { replaceEqualDeep } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

/**
 * Keeps each item's object identity while its content is unchanged. React
 * Query shares structure by array index, so one inserted or dropped comment
 * gives every comment after it a new identity and would re-render its row.
 */
export function useStableById<T extends { id: number }>(items: T[]): T[] {
	const previous = useRef(items);
	return useMemo(() => {
		const previousById = new Map(
			previous.current.map((item) => [item.id, item]),
		);
		const next = items.map((item) => {
			const before = previousById.get(item.id);
			return before ? replaceEqualDeep(before, item) : item;
		});
		const unchanged =
			next.length === previous.current.length &&
			next.every((item, index) => item === previous.current[index]);
		if (!unchanged) previous.current = next;
		return previous.current;
	}, [items]);
}
