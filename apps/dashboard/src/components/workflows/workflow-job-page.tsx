import {
	ChevronDownIcon,
	ChevronRightIcon,
	ExternalLinkIcon,
	RefreshCwIcon,
} from "@diffkit/icons";
import { Skeleton } from "@diffkit/ui/components/skeleton";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	CheckStateIcon,
	getCheckState,
	getCheckStateColor,
} from "#/components/checks/check-state-icon";
import {
	DetailPageLayout,
	DetailPageSkeletonLayout,
	StaggerItem,
} from "#/components/details/detail-page";
import {
	githubQueryKeys,
	githubViewerQueryOptions,
	githubWorkflowJobLogsQueryOptions,
	githubWorkflowRunJobsQueryOptions,
	githubWorkflowRunLogsBundleQueryOptions,
	githubWorkflowRunQueryOptions,
	workflowZipJobName,
} from "#/lib/github.query";
import type { WorkflowRunJob, WorkflowRunStep } from "#/lib/github.types";
import { githubRevalidationSignalKeys } from "#/lib/github-revalidation";
import { useGitHubSignalStream } from "#/lib/use-github-signal-stream";
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
import { StepLogContent } from "./graph/step-log-content";
import { getStepHashId } from "./step-hash";
import { WorkflowRunHeader } from "./workflow-run-header";
import { WorkflowRunSidebar } from "./workflow-run-sidebar";

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

	const webhookTargets = useMemo(() => {
		const runInput = { owner, repo, runId: runIdNum };
		const runSignal = githubRevalidationSignalKeys.workflowRunEntity(runInput);
		const jobSignal = githubRevalidationSignalKeys.workflowJobEntity({
			owner,
			repo,
			jobId: jobIdNum,
		});
		return [
			{
				queryKey: githubQueryKeys.actions.workflowRun(scope, runInput),
				signalKeys: [runSignal],
			},
			{
				queryKey: githubQueryKeys.actions.workflowRunJobs(scope, runInput),
				signalKeys: [runSignal, jobSignal],
			},
			{
				queryKey: githubQueryKeys.actions.workflowJobLogs(scope, {
					owner,
					repo,
					jobId: jobIdNum,
				}),
				signalKeys: [runSignal, jobSignal],
			},
			{
				queryKey: githubQueryKeys.actions.workflowRunLogsBundle(scope, {
					...runInput,
					attempt: runQuery.data?.runAttempt,
				}),
				signalKeys: [runSignal],
			},
		];
	}, [scope, owner, repo, runIdNum, jobIdNum, runQuery.data?.runAttempt]);
	useGitHubSignalStream(webhookTargets);

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
	if (!run) return <WorkflowJobPageSkeleton />;

	const jobs = jobsQuery.data ?? [];
	const pullRequestNumber = run.pullRequests[0]?.number ?? null;

	return (
		<DetailPageLayout
			main={
				<>
					<WorkflowRunHeader
						owner={owner}
						repo={repo}
						run={run}
						pullRequestNumber={pullRequestNumber}
						scope={scope}
					/>
					<JobContainer
						job={job}
						isJobLoading={jobsQuery.isLoading}
						rawLogs={logsQuery.data?.logs ?? null}
						bundleStepLogs={bundleStepLogs}
						notAvailable={
							isRunCompleted
								? bundleQuery.data?.notAvailable === true
								: logsQuery.data?.notAvailable === true
						}
						isLogsLoading={
							isRunCompleted ? bundleQuery.isLoading : logsQuery.isLoading
						}
						isLogsError={
							isRunCompleted ? bundleQuery.isError : logsQuery.isError
						}
						isLogsFetching={
							isRunCompleted ? bundleQuery.isFetching : logsQuery.isFetching
						}
						onRefresh={() => {
							if (isRunCompleted) {
								void bundleQuery.refetch();
							} else {
								void logsQuery.refetch();
							}
						}}
						isRunCompleted={isRunCompleted}
						owner={owner}
						repo={repo}
						runId={runIdNum}
						jobId={jobIdNum}
						scope={scope}
					/>
				</>
			}
			sidebar={
				<WorkflowRunSidebar
					jobs={jobs}
					isJobsLoading={jobsQuery.isLoading}
					owner={owner}
					repo={repo}
					runId={runIdNum}
					activeJobId={jobIdNum}
				/>
			}
		/>
	);
}

function WorkflowJobPageSkeleton() {
	return (
		<DetailPageSkeletonLayout mainItemCount={2}>
			<StaggerItem index={0}>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-3 w-40" />
					<div className="flex items-start gap-3">
						<Skeleton className="mt-1 size-5 rounded-full" />
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton className="h-7 w-3/5" />
							<Skeleton className="h-4 w-40" />
						</div>
					</div>
				</div>
			</StaggerItem>
			<StaggerItem index={1}>
				<div className="flex h-48 items-center rounded-xl border px-6">
					<Skeleton className="h-12 w-52" />
				</div>
			</StaggerItem>
		</DetailPageSkeletonLayout>
	);
}

function JobContainer({
	job,
	isJobLoading,
	rawLogs,
	bundleStepLogs,
	notAvailable,
	isLogsLoading,
	isLogsError,
	isLogsFetching,
	onRefresh,
	isRunCompleted,
	owner,
	repo,
	runId,
	jobId,
	scope,
}: {
	job: WorkflowRunJob | null;
	isJobLoading: boolean;
	rawLogs: string | null;
	bundleStepLogs: Record<number, string> | null;
	notAvailable: boolean;
	isLogsLoading: boolean;
	isLogsError: boolean;
	isLogsFetching: boolean;
	onRefresh: () => void;
	isRunCompleted: boolean;
	owner: string;
	repo: string;
	runId: number;
	jobId: number;
	scope: { userId: string };
}) {
	const queryClient = useQueryClient();
	const handleInvalidateAll = useCallback(() => {
		if (isRunCompleted) {
			void queryClient.invalidateQueries({
				queryKey: githubQueryKeys.actions.workflowRunLogsBundle(scope, {
					owner,
					repo,
					runId,
				}),
			});
		} else {
			void queryClient.invalidateQueries({
				queryKey: githubQueryKeys.actions.workflowJobLogs(scope, {
					owner,
					repo,
					jobId,
				}),
			});
		}
		onRefresh();
	}, [
		queryClient,
		scope,
		owner,
		repo,
		runId,
		jobId,
		onRefresh,
		isRunCompleted,
	]);

	const logLines = useMemo(
		() => (rawLogs ? splitLogLines(rawLogs) : null),
		[rawLogs],
	);

	if (!job) {
		return (
			<div className="overflow-hidden rounded-xl border bg-surface-1">
				<div className="flex items-center justify-center px-4 py-16 text-muted-foreground text-sm">
					{isJobLoading ? (
						<>
							<Spinner className="mr-2 size-4" />
							Loading job…
						</>
					) : (
						"Job not found."
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-xl border bg-surface-1">
			<JobHeader
				job={job}
				isLogsFetching={isLogsFetching}
				onRefresh={handleInvalidateAll}
			/>
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
							notAvailable={notAvailable}
							isLogsLoading={isLogsLoading}
							isLogsError={isLogsError}
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
	isLogsFetching,
	onRefresh,
}: {
	job: WorkflowRunJob;
	isLogsFetching: boolean;
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
					disabled={isLogsFetching}
					className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
					aria-label="Refresh logs"
				>
					{isLogsFetching ? (
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
		<div className="border-t px-4 py-2 text-muted-foreground text-xs">
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
	notAvailable,
	isLogsLoading,
	isLogsError,
}: {
	step: WorkflowRunStep;
	/** Authoritative per-step content from the run-level zip, when available. */
	stepLogText: string | null;
	/** Per-job text fallback (used when the bundle isn't available — typically in-progress runs). */
	logLines: string[] | null;
	notAvailable: boolean;
	isLogsLoading: boolean;
	isLogsError: boolean;
}) {
	const hashId = getStepHashId(step.name, step.number);
	const rowRef = useRef<HTMLDivElement>(null);
	const [expanded, setExpanded] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.location.hash.slice(1) === hashId;
	});

	useEffect(() => {
		const syncFromHash = () => {
			if (window.location.hash.slice(1) !== hashId) return;
			setExpanded(true);
			rowRef.current?.scrollIntoView({ block: "start" });
		};
		syncFromHash();
		window.addEventListener("hashchange", syncFromHash);
		return () => window.removeEventListener("hashchange", syncFromHash);
	}, [hashId]);

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
	const hasLogs = entries.length > 0;

	return (
		<div
			ref={rowRef}
			id={hashId}
			className="scroll-mt-4 border-t first:border-t-0"
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
				<div id={`${hashId}-content`} className="border-t bg-background">
					<StepLogContent
						entries={entries}
						totalLineCount={totalLineCount}
						isLoading={isLogsLoading}
						isError={isLogsError}
						notAvailable={notAvailable}
						hasLogs={hasLogs}
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
