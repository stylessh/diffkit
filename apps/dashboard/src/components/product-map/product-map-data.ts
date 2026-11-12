import diffkitMap from "./data/diffkit.json?raw";
import { type MappedRepo, mappedRepo } from "./product-map-repos";
import type { ProductArea, ProductMap } from "./product-map-types";

const maps: Record<MappedRepo, string> = {
	"stylessh/diffkit": diffkitMap,
};

export type LoadedProductMap = ProductMap & {
	areaById: Map<string, ProductArea>;
	order: string[];
};

const loaded = new Map<string, LoadedProductMap>();

export function loadProductMap(
	owner: string,
	repo: string,
): LoadedProductMap | null {
	const key = mappedRepo(owner, repo);
	if (!key) return null;
	const cached = loaded.get(key);
	if (cached) return cached;
	const map = JSON.parse(maps[key]) as ProductMap;
	const result: LoadedProductMap = {
		...map,
		areaById: new Map(map.areas.map((area) => [area.id, area])),
		order: map.bands.flatMap((band) =>
			band.groups.flatMap((group) => group.areas),
		),
	};
	loaded.set(key, result);
	return result;
}
