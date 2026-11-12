import { lazy, Suspense } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";

const PullFootprintAreas = lazy(() =>
	import("./pull-footprint-areas").then((module) => ({
		default: module.PullFootprintAreas,
	})),
);

/**
 * "Product areas" for the pull request side panel. Render it only for a
 * repository known to have a map: the code and the two reads behind it load
 * on demand, so every other pull request page pays nothing.
 */
export function PullProductAreas(props: {
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
}) {
	return (
		<Suspense fallback={null}>
			<PullFootprintAreas {...props} />
		</Suspense>
	);
}
