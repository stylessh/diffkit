import type { LoadedProductMap } from "./product-map-data";
import type { MapLens, ProductArea } from "./product-map-types";

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

/** The noun alone, in the number that goes with `count`. */
export function noun(count: number, singular: string) {
	return count === 1 ? singular : `${singular}s`;
}

export function plural(count: number, noun: string) {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function shortPath(path: string) {
	const parts = path.split("/");
	return parts.length <= 2 ? path : parts.slice(-2).join("/");
}

/** Open pull requests with lines in the area, plus its open hinted issues. */
export function openWorkCount(map: LoadedProductMap, area: ProductArea) {
	const live = map.activity?.areas[area.id];
	return live ? live.openPulls + live.openIssues.length : 0;
}

export function lensValue(
	area: ProductArea,
	lens: MapLens,
	map: LoadedProductMap,
) {
	const live = map.activity?.areas[area.id];
	if (!live) return 0;
	if (lens === "activity") return live.mergedLast30;
	if (lens === "size") return live.files;
	if (lens === "open") return openWorkCount(map, area);
	return 0;
}

export function lensLabel(
	area: ProductArea,
	lens: MapLens,
	map: LoadedProductMap,
) {
	if (lens === "structure" || !map.activity) return null;
	return formatCount(lensValue(area, lens, map));
}

export const lensDescriptions: Record<MapLens, string> = {
	structure: "How the product is put together",
	activity: "Pull requests merged in the last 30 days",
	size: "Files in each area",
	open: "Open pull requests and issues",
};
