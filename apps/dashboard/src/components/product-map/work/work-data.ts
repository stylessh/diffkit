import diffkitWork from "../data/diffkit-work.json?raw";
import type { LoadedProductMap } from "../product-map-data";
import { type MappedRepo, mappedRepo } from "../product-map-repos";
import type { ProductArea } from "../product-map-types";

/** How much of one pull request lands on one product area, by lines changed. */
export type WorkPart = { area: string; lines: number; share: number };

export type PullWork = { fix: boolean; parts: WorkPart[] };

/** One pull request as seen from a single area. */
export type AreaTouch = {
	number: number;
	lines: number;
	share: number;
	fix: boolean;
};

export type ProductWork = {
	pulls: Map<number, PullWork>;
	/** Oldest first. */
	byArea: Map<string, AreaTouch[]>;
};

/**
 * Pull requests with any change in the area, by state. This is the count the
 * area page and the overview agree on; `area.pulls` only lists the pull
 * requests that are mainly about the area.
 */
export function areaPullCounts(map: LoadedProductMap, areaId: string) {
	const touches =
		loadProductWork(map.repo.owner, map.repo.name)?.byArea.get(areaId) ?? [];
	let merged = 0;
	let open = 0;
	for (const touch of touches) {
		const state = map.pulls[touch.number]?.state;
		if (state === "merged") merged += 1;
		else if (state === "open") open += 1;
	}
	return { merged, open };
}

export function openWorkCount(map: LoadedProductMap, area: ProductArea) {
	return areaPullCounts(map, area.id).open + area.issues.open.length;
}

type WorkFile = { repo: string; pulls: Record<string, PullWork> };

const files: Record<MappedRepo, string> = {
	"stylessh/diffkit": diffkitWork,
};

const loaded = new Map<string, ProductWork>();

export function loadProductWork(
	owner: string,
	repo: string,
): ProductWork | null {
	const key = mappedRepo(owner, repo);
	if (!key) return null;
	const cached = loaded.get(key);
	if (cached) return cached;
	const file = JSON.parse(files[key]) as WorkFile;
	const pulls = new Map<number, PullWork>();
	const byArea = new Map<string, AreaTouch[]>();
	const numbers = Object.keys(file.pulls)
		.map(Number)
		.sort((a, b) => a - b);
	for (const number of numbers) {
		const pull = file.pulls[number];
		pulls.set(number, pull);
		for (const part of pull.parts) {
			const touches = byArea.get(part.area) ?? [];
			touches.push({
				number,
				lines: part.lines,
				share: part.share,
				fix: pull.fix,
			});
			byArea.set(part.area, touches);
		}
	}
	const result = { pulls, byArea };
	loaded.set(key, result);
	return result;
}
