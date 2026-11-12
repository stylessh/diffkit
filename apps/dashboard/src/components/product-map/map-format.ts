import type { LoadedProductMap } from "./product-map-data";
import type { MapLens, ProductArea } from "./product-map-types";
import { openWorkCount } from "./work/work-data";

const shortDate = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
});
const monthName = new Intl.DateTimeFormat("en", {
	month: "short",
	timeZone: "UTC",
});
const utcDay = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
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

const DAY_MS = 86_400_000;

/** The Monday-to-Sunday span of week `index`, counted from `weekStart`. */
export function formatWeekRange(weekStart: string, index: number) {
	const start = new Date(weekStart).getTime() + index * 7 * DAY_MS;
	return `${utcDay.format(start)} – ${utcDay.format(start + 6 * DAY_MS)}`;
}

export function formatCount(value: number) {
	return compact.format(value).toLowerCase();
}

export function formatShare(share: number) {
	return share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`;
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

export function lensValue(
	area: ProductArea,
	lens: MapLens,
	map: LoadedProductMap,
) {
	if (lens === "activity") return area.stats.commitsLast30;
	if (lens === "size") return area.stats.loc;
	if (lens === "open") return openWorkCount(map, area);
	return 0;
}

export function lensLabel(
	area: ProductArea,
	lens: MapLens,
	map: LoadedProductMap,
) {
	if (lens === "structure") return null;
	return formatCount(lensValue(area, lens, map));
}

export const lensDescriptions: Record<MapLens, string> = {
	structure: "How the product is put together",
	activity: "Commits in the 30 days before the snapshot",
	size: "Lines of source, tests excluded",
	open: "Open pull requests and issues",
};
