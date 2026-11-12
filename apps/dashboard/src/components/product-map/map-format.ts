import type { MapLens, ProductArea } from "./product-map-types";

const shortDate = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
});
const monthName = new Intl.DateTimeFormat("en", {
	month: "short",
	timeZone: "UTC",
});
const compact = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
});

export function formatShortDate(iso: string | null) {
	return iso ? shortDate.format(new Date(iso)) : "never";
}

export function formatMonth(date: Date) {
	return monthName.format(date);
}

export function formatCount(value: number) {
	return compact.format(value).toLowerCase();
}

export function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function githubBlobUrl(
	repoUrl: string,
	branch: string,
	path: string,
	line?: number,
) {
	return `${repoUrl}/blob/${branch}/${path}${line ? `#L${line}` : ""}`;
}

export function shortPath(path: string) {
	const parts = path.split("/");
	return parts.length <= 2 ? path : parts.slice(-2).join("/");
}

export function lensValue(area: ProductArea, lens: MapLens) {
	if (lens === "activity") return area.stats.commitsLast30;
	if (lens === "size") return area.stats.loc;
	if (lens === "open") return area.stats.openPulls + area.stats.openIssues;
	return 0;
}

export function lensLabel(area: ProductArea, lens: MapLens) {
	if (lens === "structure") return null;
	return formatCount(lensValue(area, lens));
}

export const lensDescriptions: Record<MapLens, string> = {
	structure: "How the product is put together",
	activity: "Commits in the 30 days before the snapshot",
	size: "Lines of source, tests excluded",
	open: "Open pull requests and issues",
};
