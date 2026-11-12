import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	githubRepoOverviewQueryOptions,
	githubRepoProductMapActivityQueryOptions,
	githubRepoProductMapFileQueryOptions,
} from "#/lib/github.query";
import type { MapActivity } from "#/lib/product-map/activity";
import type {
	MapBand,
	MapFile,
	OutsideSystem,
	TourStop,
} from "#/lib/product-map/map-file";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import type { ProductArea } from "./product-map-types";

/**
 * A repository's map as the page reads it: what its map file says, and, once
 * GitHub has been counted, the live numbers in `activity`.
 */
export type LoadedProductMap = {
	repo: { owner: string; name: string; branch: string };
	pitch: string;
	description: string;
	bands: MapBand[];
	outside: OutsideSystem[];
	tour: TourStop[];
	areas: ProductArea[];
	areaById: Map<string, ProductArea>;
	order: string[];
	activity: MapActivity | null;
};

export function loadProductMap(
	file: MapFile,
	repo: LoadedProductMap["repo"],
	activity: MapActivity | null,
): LoadedProductMap {
	const areas = file.areas.map((area) => ({
		...area,
		usedBy: file.areas
			.filter((other) => other.dependsOn.includes(area.id))
			.map((other) => other.id),
	}));
	return {
		repo,
		pitch: file.pitch,
		description: file.description,
		bands: file.bands,
		outside: file.outside,
		tour: file.tour,
		areas,
		areaById: new Map(areas.map((area) => [area.id, area])),
		order: file.bands.flatMap((band) =>
			band.groups.flatMap((group) => group.areas),
		),
		activity,
	};
}

export type ProductMapState =
	| { status: "loading" }
	| { status: "missing" }
	| { status: "invalid"; problems: string[] }
	| { status: "ready"; map: LoadedProductMap };

export function useProductMap(owner: string, repo: string): ProductMapState {
	const scope = useGitHubQueryScope();
	const input = { owner, repo };
	const file = useQuery(githubRepoProductMapFileQueryOptions(scope, input));
	const ready = file.data?.status === "ready";
	const activity = useQuery({
		...githubRepoProductMapActivityQueryOptions(scope, input),
		enabled: ready,
	});
	const overview = useQuery({
		...githubRepoOverviewQueryOptions(scope, input),
		enabled: ready,
	});
	// "HEAD" until the overview answers: the code pages accept it as a ref.
	const branch = overview.data?.defaultBranch ?? "HEAD";

	return useMemo((): ProductMapState => {
		if (!file.data) return { status: "loading" };
		if (file.data.status !== "ready") return file.data;
		return {
			status: "ready",
			map: loadProductMap(
				file.data.map,
				{ owner, name: repo, branch },
				activity.data ?? null,
			),
		};
	}, [file.data, activity.data, owner, repo, branch]);
}
