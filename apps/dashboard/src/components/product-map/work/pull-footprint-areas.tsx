import { AlertCircleIcon } from "@diffkit/icons";
import { PanelRow, PanelSection } from "@diffkit/ui/components/detail-layout";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "skullet/react";
import type { PullProductAreas } from "#/lib/github/product-map";
import {
	type GitHubQueryScope,
	githubPullProductAreasQueryOptions,
} from "#/lib/github.query";
import { formatShare } from "../map-format";
import { areaIcon } from "../map-icons";

/** Stands in for the areas while they are read, so skullet has a bar to measure. */
const SAMPLE_AREAS: PullProductAreas = {
	areas: [
		{ id: "inbox", name: "Inbox", icon: "inbox", share: 0.62 },
		{ id: "storage", name: "Storage", icon: "layers", share: 0.27 },
		{ id: "sync", name: "Sync", icon: "refresh", share: 0.11 },
	],
	unmappedFiles: 0,
};

/** The product areas one pull request changes, largest share first. */
export function PullFootprintAreas({
	owner,
	repo,
	pullNumber,
	scope,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	scope: GitHubQueryScope;
}) {
	const { data } = useQuery(
		githubPullProductAreasQueryOptions(scope, { owner, repo, pullNumber }),
	);
	return (
		<Skeleton data={data} sample={SAMPLE_AREAS} label="Loading product areas">
			{(footprint) => (
				<FootprintSection footprint={footprint} owner={owner} repo={repo} />
			)}
		</Skeleton>
	);
}

/**
 * The accent in four strengths, strongest for the largest share, each with an
 * ink its icon can be read in. One hue, so the bar says "most of it is here"
 * and stays in the dashboard's palette.
 */
const SHARE_STYLES = [
	"bg-indigo text-indigo-foreground",
	"bg-indigo/65 text-indigo-foreground",
	"bg-indigo/40 text-foreground",
	"bg-indigo/22 text-foreground",
];
/** Every area past those, gathered into one closing segment. */
const REST_STYLE = "bg-foreground/12 text-muted-foreground";
/** How many of the gathered areas its tooltip names before it just counts. */
const REST_NAMED = 8;

const segmentClassName =
	"flex h-7 w-full items-center justify-center rounded-[4px] transition-opacity hover:opacity-80";

/**
 * How one pull request splits across the product's areas: one bar, cut by
 * share, largest first. A segment wide enough carries its area's icon;
 * pointing at one names it, and it opens that area. The small areas after the
 * first few share one segment, so the bar never ends in a row of slivers.
 */
function FootprintSection({
	footprint,
	owner,
	repo,
}: {
	footprint: PullProductAreas;
	owner: string;
	repo: string;
}) {
	const { areas, unmappedFiles } = footprint;
	if (areas.length + unmappedFiles === 0) return null;

	// One area past the fills is drawn as itself: a group of one says less.
	const own =
		areas.length > SHARE_STYLES.length + 1
			? areas.slice(0, SHARE_STYLES.length)
			: areas;
	const rest = areas.slice(own.length);
	const restShare = rest.reduce((sum, area) => sum + area.share, 0);

	return (
		<PanelSection label="Product areas">
			{areas.length > 0 ? (
				<ul className="flex gap-0.5 py-0.5">
					{own.map((area, index) => {
						const Icon = areaIcon(area.icon);
						const label = `${area.name} · ${formatShare(area.share)}`;
						return (
							<li
								key={area.id}
								style={{ flexGrow: area.share }}
								className="@container flex min-w-1.5 basis-0"
							>
								<Tooltip>
									<TooltipTrigger asChild>
										<Link
											to="/$owner/$repo/map"
											params={{ owner, repo }}
											search={{ area: area.id }}
											aria-label={label}
											className={cn(
												segmentClassName,
												index === 0 && "rounded-l-lg",
												index === areas.length - 1 && "rounded-r-lg",
												SHARE_STYLES[index] ?? REST_STYLE,
											)}
										>
											<Icon
												size={14}
												strokeWidth={2}
												className="@min-[1.25rem]:block hidden"
											/>
										</Link>
									</TooltipTrigger>
									<TooltipContent>{label}</TooltipContent>
								</Tooltip>
							</li>
						);
					})}
					{rest.length > 0 ? (
						<li
							style={{ flexGrow: restShare }}
							className="@container flex min-w-1.5 basis-0"
						>
							<Tooltip>
								<TooltipTrigger asChild>
									<Link
										to="/$owner/$repo/map"
										params={{ owner, repo }}
										aria-label={`${rest.length} more areas · ${formatShare(restShare)}`}
										className={cn(segmentClassName, "rounded-r-lg", REST_STYLE)}
									>
										<span className="@min-[1.5rem]:block hidden font-medium text-[11px] tabular-nums">
											+{rest.length}
										</span>
									</Link>
								</TooltipTrigger>
								<TooltipContent className="flex-col items-stretch gap-1">
									{rest.slice(0, REST_NAMED).map((area) => (
										<span key={area.id} className="flex justify-between gap-6">
											{area.name}
											<span className="font-[450] text-muted-foreground tabular-nums">
												{formatShare(area.share)}
											</span>
										</span>
									))}
									{rest.length > REST_NAMED ? (
										<span className="font-[450] text-muted-foreground">
											and {rest.length - REST_NAMED} more
										</span>
									) : null}
								</TooltipContent>
							</Tooltip>
						</li>
					) : null}
				</ul>
			) : null}
			{unmappedFiles > 0 ? (
				<PanelRow
					muted
					icon={
						<AlertCircleIcon
							size={14}
							strokeWidth={2}
							className="text-warning"
						/>
					}
					title="These files match no area's paths yet. Update the product map so they are counted."
				>
					<span className="text-text-header tabular-nums">{unmappedFiles}</span>
					{unmappedFiles === 1 ? "file" : "files"} outside the map
				</PanelRow>
			) : null}
		</PanelSection>
	);
}
