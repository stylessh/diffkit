import { FilterIcon } from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import {
	DetailSidebar,
	DetailSidebarSection,
} from "#/components/details/detail-sidebar";
import type { WorkflowRunJob } from "#/lib/github.types";

export function WorkflowRunSidebar({
	jobs,
	isJobsLoading,
	owner,
	repo,
	runId,
	activeJobId = null,
}: {
	jobs: WorkflowRunJob[];
	isJobsLoading: boolean;
	owner: string;
	repo: string;
	runId: number;
	activeJobId?: number | null;
}) {
	return (
		<DetailSidebar>
			<DetailSidebarSection
				title="All jobs"
				titleRight={
					<button
						type="button"
						aria-label="Filter jobs"
						disabled
						title="Filtering coming soon"
						className="rounded-md p-1 text-muted-foreground opacity-50 transition-colors"
					>
						<FilterIcon size={13} strokeWidth={2} />
					</button>
				}
			>
				<div className="flex flex-col gap-0.5">
					{isJobsLoading && jobs.length === 0 ? (
						<JobListSkeleton />
					) : jobs.length === 0 ? (
						<p className="px-2 py-1 text-xs text-muted-foreground">
							No jobs yet.
						</p>
					) : (
						jobs.map((job) => {
							const state = getCheckState(job);
							const isActive = job.id === activeJobId;
							return (
								<Link
									key={job.id}
									to="/$owner/$repo/actions/runs/$runId/job/$jobId"
									params={{
										owner,
										repo,
										runId: String(runId),
										jobId: String(job.id),
									}}
									className={cn(
										"-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground",
										isActive && "bg-surface-1 text-foreground",
									)}
								>
									<CheckStateIcon state={state} />
									<span className="min-w-0 flex-1 truncate">{job.name}</span>
								</Link>
							);
						})
					)}
				</div>
			</DetailSidebarSection>
		</DetailSidebar>
	);
}

function JobListSkeleton() {
	return (
		<div className="flex flex-col gap-1.5 px-2 py-1">
			{[0, 1, 2].map((i) => (
				<div key={i} className="flex items-center gap-2">
					<Skeleton className="size-3.5 rounded-full" />
					<Skeleton className="h-3 w-32" />
				</div>
			))}
		</div>
	);
}
