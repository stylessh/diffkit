import { createContext, type ReactNode, useContext } from "react";

const SearchQueryContext = createContext("");

export function SearchQueryProvider({
	query,
	children,
}: {
	query: string;
	children: ReactNode;
}) {
	return (
		<SearchQueryContext.Provider value={query.trim()}>
			{children}
		</SearchQueryContext.Provider>
	);
}

/** Marks each case-insensitive occurrence of the list's search query in `text`. */
export function HighlightedText({ text }: { text: string }) {
	const query = useContext(SearchQueryContext);
	if (!query) return text;
	const lower = text.toLowerCase();
	const needle = query.toLowerCase();
	const parts: ReactNode[] = [];
	let cursor = 0;
	for (
		let index = lower.indexOf(needle);
		index !== -1;
		index = lower.indexOf(needle, cursor)
	) {
		if (index > cursor) parts.push(text.slice(cursor, index));
		parts.push(
			<mark
				key={index}
				className="rounded-[3px] bg-indigo/20 text-inherit dark:bg-indigo/30"
			>
				{text.slice(index, index + needle.length)}
			</mark>,
		);
		cursor = index + needle.length;
	}
	if (parts.length === 0) return text;
	if (cursor < text.length) parts.push(text.slice(cursor));
	return <>{parts}</>;
}
