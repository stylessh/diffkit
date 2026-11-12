import diffkitMap from "./data/diffkit.json?raw";
import type { ProductArea, ProductMap } from "./product-map-types";

const maps: Record<string, string> = {
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
	const key = `${owner}/${repo}`.toLowerCase();
	const cached = loaded.get(key);
	if (cached) return cached;
	const raw = maps[key];
	if (!raw) return null;
	const map = JSON.parse(raw) as ProductMap;
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
