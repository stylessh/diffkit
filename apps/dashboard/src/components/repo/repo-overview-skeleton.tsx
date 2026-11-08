import { DetailLayout } from "@diffkit/ui/components/detail-layout";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cardRowClassName, RepoCard, RepoCardHead } from "./repo-ui";

const ROWS = Array.from({ length: 8 }, (_, i) => `skeleton-row-${i}`);
const PANEL_ROWS = ["a", "b", "c", "d"];

export function RepoOverviewSkeleton() {
	return (
		<DetailLayout
			panel={
				<div className="flex flex-col gap-7">
					<div className="flex flex-col gap-2">
						<Skeleton className="h-5 w-40 rounded" />
						<Skeleton className="h-3.5 w-full rounded" />
						<Skeleton className="h-3.5 w-3/4 rounded" />
					</div>
					<div className="flex flex-col gap-3">
						<Skeleton className="h-3.5 w-20 rounded" />
						{PANEL_ROWS.map((key) => (
							<Skeleton key={key} className="h-3.5 w-52 rounded" />
						))}
					</div>
				</div>
			}
		>
			<div className="flex min-w-0 flex-col">
				<div className="flex items-center gap-1.5">
					<Skeleton className="h-7 w-24 rounded-full" />
					<Skeleton className="h-7 w-24 rounded-full" />
					<Skeleton className="ml-auto h-7 w-44 rounded-full" />
					<Skeleton className="h-7 w-20 rounded-full" />
				</div>
				<RepoCard className="-mx-3 mt-4">
					<RepoCardHead>
						<Skeleton className="size-[18px] rounded-full" />
						<Skeleton className="h-3.5 w-56 rounded" />
					</RepoCardHead>
					<div>
						{ROWS.map((key) => (
							<div key={key} className={cardRowClassName}>
								<Skeleton className="size-3.5 shrink-0 rounded" />
								<Skeleton className="h-3.5 w-28 shrink-0 rounded sm:w-40" />
								<Skeleton className="h-3.5 flex-1 rounded" />
								<Skeleton className="h-3.5 w-8 shrink-0 rounded" />
							</div>
						))}
					</div>
				</RepoCard>
			</div>
		</DetailLayout>
	);
}
