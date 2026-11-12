import type { MapFileArea } from "#/lib/product-map/map-file";

export type {
	AreaFeature,
	CodeReference,
	FlowStep,
	MapBand,
	MapGroup,
	OutsideSystem,
	TourStop,
} from "#/lib/product-map/map-file";

/** An area from the map file, plus the areas that say they build on it. */
export type ProductArea = MapFileArea & { usedBy: string[] };

export type MapLens = "structure" | "activity" | "size" | "open";
