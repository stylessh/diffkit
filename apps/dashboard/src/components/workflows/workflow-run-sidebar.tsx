import { FilterIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "skullet/react";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import {
	DetailSidebar,
	DetailSidebarSection,
} from "#/components/details/detail-sidebar";
import type { WorkflowRunJob } from "#/lib/github.types";
import { SAMPLE_WORKFLOW_JOBS } from "./workflow-samples";

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
	const isLoading = isJobsLoading && jobs.length === 0;

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
				<Skeleton
					loading={isLoading}
					label="Loading jobs"
					empty={jobs.length === 0}
					emptyMessage={
						<p className="px-2 py-1 text-xs text-muted-foreground">
							No jobs yet.
						</p>
					}
				>
					<div className="flex flex-col gap-0.5">
						{(isLoading ? SAMPLE_WORKFLOW_JOBS : jobs).map((job) => (
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
									job.id === activeJobId && "bg-surface-1 text-foreground",
								)}
							>
								<CheckStateIcon state={getCheckState(job)} />
								<span className="min-w-0 flex-1 truncate">{job.name}</span>
							</Link>
						))}
					</div>
				</Skeleton>
			</DetailSidebarSection>
		</DetailSidebar>
	);
}
