import type { LoadedProductMap } from "./product-map-data";

export type Spotlight =
	| { kind: "none" }
	| { kind: "area"; id: string }
	| { kind: "stop"; areas: string[]; outside: string[] };

export type TileRole = "plain" | "self" | "related" | "dim";

export const NO_SPOTLIGHT: Spotlight = { kind: "none" };

export function tileRole(
	spotlight: Spotlight,
	areaId: string,
	map: LoadedProductMap,
): TileRole {
	if (spotlight.kind === "none") return "plain";
	if (spotlight.kind === "stop")
		return spotlight.areas.includes(areaId) ? "self" : "dim";
	if (spotlight.id === areaId) return "self";
	const focused = map.areaById.get(spotlight.id);
	const related =
		focused?.dependsOn.includes(areaId) || focused?.usedBy.includes(areaId);
	return related ? "related" : "dim";
}

export function litOutsideOwners(
	spotlight: Spotlight,
	map: LoadedProductMap,
): Set<string> {
	if (spotlight.kind === "none") return new Set();
	const ids =
		spotlight.kind === "stop"
			? spotlight.outside
			: (map.areaById.get(spotlight.id)?.outside ?? []);
	return new Set(
		map.outside
			.filter((system) => ids.includes(system.id))
			.map((system) => system.owner),
	);
}
