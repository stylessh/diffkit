import { lazy, Suspense } from "react";
import { mappedRepo } from "../product-map-repos";

const PullFootprintAreas = lazy(() =>
	import("./pull-footprint-areas").then((module) => ({
		default: module.PullFootprintAreas,
	})),
);

/**
 * "Product areas" for the pull request side panel. The map data is fetched
 * only for a repository that has a map, so every other pull request page pays
 * nothing for it.
 */
export function PullProductAreas({
	owner,
	repo,
	pullNumber,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	if (!mappedRepo(owner, repo)) return null;
	return (
		<Suspense fallback={null}>
			<PullFootprintAreas owner={owner} repo={repo} pullNumber={pullNumber} />
		</Suspense>
	);
}
