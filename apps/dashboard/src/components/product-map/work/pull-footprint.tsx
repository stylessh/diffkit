import { PanelSection } from "@diffkit/ui/components/detail-layout";
import { lazy, Suspense } from "react";
import { SkeletonBox } from "skullet/react";
import type { GitHubQueryScope } from "#/lib/github.query";

const PullFootprintAreas = lazy(() =>
	import("./pull-footprint-areas").then((module) => ({
		default: module.PullFootprintAreas,
	})),
);

/**
 * The section while its code loads. A box, not the real bar, because the bar
 * lives in the chunk this is the fallback for; once it is here the bar draws
 * its own skeleton and reveals over it.
 */
function PullProductAreasSkeleton() {
	return (
		<PanelSection label="Product areas" aria-busy>
			<div className="flex py-0.5">
				<SkeletonBox width="100%" height={28} radius={8} />
			</div>
		</PanelSection>
	);
}

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
		<Suspense fallback={<PullProductAreasSkeleton />}>
			<PullFootprintAreas {...props} />
		</Suspense>
	);
}
