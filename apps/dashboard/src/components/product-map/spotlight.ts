import type { WireLink } from "./map-wires";
import type { LoadedProductMap } from "./product-map-data";

export type Spotlight =
	| { kind: "none" }
	| { kind: "area"; id: string }
	| { kind: "stop"; areas: string[]; outside: string[] };

export type TileRole = "plain" | "self" | "uses" | "used-by" | "lit" | "dim";

export const NO_SPOTLIGHT: Spotlight = { kind: "none" };

export const outsideNodeId = (id: string) => `outside:${id}`;

export function tileRole(
	spotlight: Spotlight,
	areaId: string,
	map: LoadedProductMap,
): TileRole {
	if (spotlight.kind === "none") return "plain";
	if (spotlight.kind === "stop")
		return spotlight.areas.includes(areaId) ? "lit" : "dim";
	if (spotlight.id === areaId) return "self";
	const focused = map.areaById.get(spotlight.id);
	if (focused?.dependsOn.includes(areaId)) return "uses";
	if (focused?.usedBy.includes(areaId)) return "used-by";
	return "dim";
}

export function outsideRole(
	spotlight: Spotlight,
	outsideId: string,
	map: LoadedProductMap,
): "plain" | "lit" | "dim" {
	if (spotlight.kind === "none") return "plain";
	const lit =
		spotlight.kind === "stop"
			? spotlight.outside
			: (map.areaById.get(spotlight.id)?.outside ?? []);
	return lit.includes(outsideId) ? "lit" : "dim";
}

export function spotlightLinks(
	spotlight: Spotlight,
	map: LoadedProductMap,
): WireLink[] {
	if (spotlight.kind !== "area") return [];
	const area = map.areaById.get(spotlight.id);
	if (!area) return [];
	return [
		...area.usedBy.map(
			(id): WireLink => ({ from: id, to: area.id, kind: "used-by" }),
		),
		...area.dependsOn.map(
			(id): WireLink => ({ from: area.id, to: id, kind: "uses" }),
		),
		...area.outside.map(
			(id): WireLink => ({
				from: area.id,
				to: outsideNodeId(id),
				kind: "outside",
			}),
		),
	];
}
