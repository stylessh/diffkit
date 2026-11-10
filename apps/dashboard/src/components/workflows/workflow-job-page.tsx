import {
	ChevronDownIcon,
	ChevronRightIcon,
	ExternalLinkIcon,
	RefreshCwIcon,
} from "@diffkit/icons";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "skullet/react";
import {
	CheckStateIcon,
	getCheckState,
	getCheckStateColor,
} from "#/components/checks/check-state-icon";
import { DetailPageLayout } from "#/components/details/detail-page";
import {
	SkeletonSample,
	useIsSkeletonSample,
} from "#/components/shared/skeleton-sample";
import {
	githubViewerQueryOptions,
	githubWorkflowJobLogsQueryOptions,
	githubWorkflowRunJobsQueryOptions,
	githubWorkflowRunLogsBundleQueryOptions,
	githubWorkflowRunQueryOptions,
	workflowZipJobName,
} from "#/lib/github.query";
import type { WorkflowRunJob, WorkflowRunStep } from "#/lib/github.types";
import { useHasMounted } from "#/lib/use-has-mounted";
import { useNow } from "#/lib/use-now";
import { useRegisterTab } from "#/lib/use-register-tab";
import { formatDuration } from "./graph/format";
import {
	countEntryLines,
	extractStepLog,
	type LogEntry,
	parseStepLogContent,
	splitLogLines,
} from "./graph/parse-step-log";
import {
	StepLogContent,
	type StepLogFetchStatus,
	stepLogFetchStatus,
} from "./graph/step-log-content";
import { getStepHashId } from "./step-hash";
import { useManualRefresh } from "./use-manual-refresh";
import { WorkflowRunHeader } from "./workflow-run-header";
import { WorkflowRunSidebar } from "./workflow-run-sidebar";
import { SAMPLE_WORKFLOW_JOB, SAMPLE_WORKFLOW_RUN } from "./workflow-samples";

const routeApi = getRouteApi(
	"/_protected/$owner/$repo/actions/runs/$runId_/job/$jobId",
);

export function WorkflowJobPage() {
	const { user } = routeApi.useRouteContext();
	const { owner, repo, runId, jobId } = routeApi.useParams();

	const scope = useMemo(() => ({ userId: user.id }), [user.id]);
	const runIdNum = Number(runId);
	const jobIdNum = Number(jobId);
	const hasMounted = useHasMounted();

	useQuery({
		...githubViewerQueryOptions(scope),
		enabled: hasMounted,
	});
	const runQuery = useQuery({
		...githubWorkflowRunQueryOptions(scope, {
			owner,
			repo,
			runId: runIdNum,
		}),
		enabled: hasMounted,
	});
	const jobsQuery = useQuery({
		...githubWorkflowRunJobsQueryOptions(scope, {
			owner,
			repo,
			runId: runIdNum,
		}),
		enabled: hasMounted,
	});

	const job = useMemo(
		() => jobsQuery.data?.find((j) => j.id === jobIdNum) ?? null,
		[jobsQuery.data, jobIdNum],
	);
	const isJobLive = job ? job.status !== "completed" : true;
	const isRunCompleted = runQuery.data?.status === "completed";

	const logsQuery = useQuery({
		...githubWorkflowJobLogsQueryOptions(scope, {
			owner,
			repo,
			jobId: jobIdNum,
		}),
		enabled: hasMounted && !isRunCompleted,
		refetchInterval: isJobLive ? 4000 : false,
	});

	const bundleQuery = useQuery({
		...githubWorkflowRunLogsBundleQueryOptions(scope, {
			owner,
			repo,
			runId: runIdNum,
			attempt: runQuery.data?.runAttempt,
		}),
		enabled: hasMounted && isRunCompleted,
	});

	const bundleStepLogs = useMemo<Record<number, string> | null>(() => {
		if (!job || !bundleQuery.data || bundleQuery.data.notAvailable) return null;
		const key = workflowZipJobName(job.name);
		return bundleQuery.data.jobs[key]?.steps ?? null;
	}, [job, bundleQuery.data]);

	useRegisterTab(
		runQuery.data && job
			? {
					type: "actions",
					title: job.name,
					number: runQuery.data.runNumber,
					url: `/${owner}/${repo}/actions/runs/${runIdNum}/job/${jobIdNum}`,
					repo: `${owner}/${repo}`,
					iconColor: getCheckStateColor(getCheckState(job)),
					tabId: `actions:${owner}/${repo}/run/${runIdNum}/job/${jobIdNum}`,
				}
			: null,
	);

	if (runQuery.error) throw runQuery.error;
	const run = runQuery.data;
	const jobs = jobsQuery.data ?? [];
	const activeLogsQuery = isRunCompleted ? bundleQuery : logsQuery;
	const isJobLoading = jobsQuery.isPending && !jobsQuery.data;

	return (
		<DetailPageLayout
			main={
				<Skeleton loading={!run} label="Loading workflow job">
					{run ? (
						<div className="flex flex-col gap-8">
							<WorkflowRunHeader
								owner={owner}
								repo={repo}
								run={run}
								pullRequestNumber={run.pullRequests[0]?.number ?? null}
								scope={scope}
							/>
							<Skeleton loading={isJobLoading} label="Loading job">
								{isJobLoading ? (
									<SampleJobCard owner={owner} repo={repo} runId={runIdNum} />
								) : job ? (
									<JobCard
										job={job}
										rawLogs={logsQuery.data?.logs ?? null}
										bundleStepLogs={bundleStepLogs}
										logsFetchStatus={stepLogFetchStatus(activeLogsQuery)}
										onRefresh={activeLogsQuery.refetch}
										owner={owner}
										repo={repo}
										runId={runIdNum}
									/>
								) : (
									<JobNotFound />
								)}
							</Skeleton>
						</div>
					) : (
						<div className="flex flex-col gap-8">
							<SkeletonSample>
								<WorkflowRunHeader
									owner={owner}
									repo={repo}
									run={SAMPLE_WORKFLOW_RUN}
									pullRequestNumber={null}
									scope={scope}
								/>
							</SkeletonSample>
							<SampleJobCard owner={owner} repo={repo} runId={runIdNum} />
						</div>
					)}
				</Skeleton>
			}
			sidebar={
				<WorkflowRunSidebar
					jobs={jobs}
					isJobsLoading={!run || jobsQuery.isLoading}
					owner={owner}
					repo={repo}
					runId={runIdNum}
					activeJobId={jobIdNum}
				/>
			}
		/>
	);
}

const refreshNothing = () => Promise.resolve();

function SampleJobCard({
	owner,
	repo,
	runId,
}: {
	owner: string;
	repo: string;
	runId: number;
}) {
	return (
		<SkeletonSample>
			<JobCard
				job={SAMPLE_WORKFLOW_JOB}
				rawLogs={null}
				bundleStepLogs={null}
				logsFetchStatus="ready"
				onRefresh={refreshNothing}
				owner={owner}
				repo={repo}
				runId={runId}
			/>
		</SkeletonSample>
	);
}

function JobNotFound() {
	return (
		<div className="overflow-hidden rounded-xl border-[0.5px] bg-surface-1">
			<div className="flex items-center justify-center px-4 py-16 text-muted-foreground text-sm">
				Job not found.
			</div>
		</div>
	);
}

function JobCard({
	job,
	rawLogs,
	bundleStepLogs,
	logsFetchStatus,
	onRefresh,
	owner,
	repo,
	runId,
}: {
	job: WorkflowRunJob;
	rawLogs: string | null;
	bundleStepLogs: Record<number, string> | null;
	logsFetchStatus: StepLogFetchStatus;
	onRefresh: () => Promise<unknown>;
	owner: string;
	repo: string;
	runId: number;
}) {
	const { refresh, isRefreshing } = useManualRefresh(onRefresh);
	const logLines = useMemo(
		() => (rawLogs ? splitLogLines(rawLogs) : null),
		[rawLogs],
	);

	return (
		<div className="overflow-hidden rounded-xl border-[0.5px] bg-surface-1">
			<JobHeader job={job} isRefreshing={isRefreshing} onRefresh={refresh} />
			<div className="flex flex-col">
				{job.steps.length === 0 ? (
					<div className="px-4 py-6 text-muted-foreground text-xs">
						No steps to display.
					</div>
				) : (
					job.steps.map((step) => (
						<JobStepRow
							key={step.number}
							step={step}
							stepLogText={bundleStepLogs?.[step.number] ?? null}
							logLines={logLines}
							logsFetchStatus={logsFetchStatus}
						/>
					))
				)}
			</div>
			<JobFooter owner={owner} repo={repo} runId={runId} />
		</div>
	);
}

function JobHeader({
	job,
	isRefreshing,
	onRefresh,
}: {
	job: WorkflowRunJob;
	isRefreshing: boolean;
	onRefresh: () => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3 px-4 py-3">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="truncate font-medium text-sm">{job.name}</span>
				<JobHeaderTimingLabel
					startedAt={job.startedAt}
					completedAt={job.completedAt}
				/>
			</div>
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={onRefresh}
					disabled={isRefreshing}
					className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
					aria-label="Refresh logs"
				>
					{isRefreshing ? (
						<Spinner className="size-3.5" />
					) : (
						<RefreshCwIcon size={14} strokeWidth={2} />
					)}
				</button>
				{job.htmlUrl ? (
					<a
						href={job.htmlUrl}
						target="_blank"
						rel="noreferrer"
						aria-label="Open in GitHub"
						className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<ExternalLinkIcon size={14} strokeWidth={2} />
					</a>
				) : null}
			</div>
		</div>
	);
}

function JobHeaderTimingLabel({
	startedAt,
	completedAt,
}: {
	startedAt: string | null;
	completedAt: string | null;
}) {
	if (!startedAt) {
		return <span className="text-muted-foreground text-xs">Queued</span>;
	}
	if (completedAt) {
		const text = formatDuration(startedAt, completedAt);
		return (
			<span className="text-muted-foreground text-xs">Ran for {text}</span>
		);
	}
	return <LiveJobHeaderTimingLabel startedAt={startedAt} />;
}

function LiveJobHeaderTimingLabel({ startedAt }: { startedAt: string }) {
	const now = useNow();
	const text = formatDuration(startedAt, null, now);
	return (
		<span className="text-muted-foreground text-xs">Started {text} ago</span>
	);
}

function JobFooter({
	owner,
	repo,
	runId,
}: {
	owner: string;
	repo: string;
	runId: number;
}) {
	return (
		<div className="border-t-[0.5px] px-4 py-2 text-muted-foreground text-xs">
			Part of workflow run{" "}
			<Link
				to="/$owner/$repo/actions/runs/$runId"
				params={{ owner, repo, runId: String(runId) }}
				className="text-foreground transition-colors hover:text-primary"
			>
				#{runId}
			</Link>
		</div>
	);
}

const JobStepRow = memo(function JobStepRow({
	step,
	stepLogText,
	logLines,
	logsFetchStatus,
}: {
	step: WorkflowRunStep;
	/** Authoritative per-step content from the run-level zip, when available. */
	stepLogText: string | null;
	/** Per-job text fallback (used when the bundle isn't available — typically in-progress runs). */
	logLines: string[] | null;
	logsFetchStatus: StepLogFetchStatus;
}) {
	const isSample = useIsSkeletonSample();
	const hashId = getStepHashId(step.name, step.number);
	const rowRef = useRef<HTMLDivElement>(null);
	const [expanded, setExpanded] = useState(() => {
		if (typeof window === "undefined" || isSample) return false;
		return window.location.hash.slice(1) === hashId;
	});

	useEffect(() => {
		if (isSample) return;
		const syncFromHash = () => {
			if (window.location.hash.slice(1) !== hashId) return;
			setExpanded(true);
			rowRef.current?.scrollIntoView({ block: "start" });
		};
		syncFromHash();
		window.addEventListener("hashchange", syncFromHash);
		return () => window.removeEventListener("hashchange", syncFromHash);
	}, [hashId, isSample]);

	const handleToggle = useCallback(() => {
		setExpanded((prev) => {
			const next = !prev;
			if (typeof window === "undefined") return next;
			const current = window.location.hash.slice(1);
			if (next) {
				if (current !== hashId) {
					history.replaceState(null, "", `#${hashId}`);
				}
			} else if (current === hashId) {
				history.replaceState(
					null,
					"",
					window.location.pathname + window.location.search,
				);
			}
			return next;
		});
	}, [hashId]);

	const entries = useMemo<LogEntry[]>(() => {
		if (stepLogText != null) return parseStepLogContent(stepLogText);
		if (!logLines) return [];
		return extractStepLog(logLines, step.name, {
			startedAt: step.startedAt,
			completedAt: step.completedAt,
		}).entries;
	}, [stepLogText, logLines, step.name, step.startedAt, step.completedAt]);

	const totalLineCount = useMemo(() => countEntryLines(entries), [entries]);
	const state = getCheckState({
		status: step.status,
		conclusion: step.conclusion,
	});
	const isStepLive = step.status !== "completed";

	return (
		<div
			ref={rowRef}
			id={hashId}
			className="scroll-mt-4 border-t-[0.5px] first:border-t-0"
		>
			<button
				type="button"
				onClick={handleToggle}
				aria-expanded={expanded}
				aria-controls={`${hashId}-content`}
				className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-muted/40"
			>
				<span className="shrink-0 text-muted-foreground">
					{expanded ? (
						<ChevronDownIcon size={12} strokeWidth={2.5} />
					) : (
						<ChevronRightIcon size={12} strokeWidth={2.5} />
					)}
				</span>
				<CheckStateIcon state={state} />
				<span className="min-w-0 flex-1 truncate text-sm">{step.name}</span>
				<StepDuration
					startedAt={step.startedAt}
					completedAt={step.completedAt}
				/>
			</button>
			{expanded ? (
				<div
					id={`${hashId}-content`}
					className="border-t-[0.5px] bg-background"
				>
					<StepLogContent
						entries={entries}
						totalLineCount={totalLineCount}
						fetchStatus={logsFetchStatus}
						isStepLive={isStepLive}
						scrollable={false}
					/>
				</div>
			) : null}
		</div>
	);
});

function StepDuration({
	startedAt,
	completedAt,
}: {
	startedAt: string | null;
	completedAt: string | null;
}) {
	if (!startedAt) return null;
	if (completedAt) {
		const text = formatDuration(startedAt, completedAt);
		return text ? (
			<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
				{text}
			</span>
		) : null;
	}
	return <LiveStepDuration startedAt={startedAt} />;
}

function LiveStepDuration({ startedAt }: { startedAt: string }) {
	const now = useNow();
	const text = formatDuration(startedAt, null, now);
	return text ? (
		<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
			{text}
		</span>
	) : null;
}
