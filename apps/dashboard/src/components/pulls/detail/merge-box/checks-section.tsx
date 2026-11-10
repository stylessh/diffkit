import { AlertCircleIcon, RefreshCwIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { StatePill } from "@diffkit/ui/components/state-pill";
import { cn } from "@diffkit/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
	type CheckState,
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import { formatRelativeTime } from "#/lib/format-relative-time";
import { approveWorkflowRuns, rerunChecks } from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type {
	PullCheckRun,
	PullStatus,
	PullWorkflowApproval,
} from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	pullEntityKey,
} from "#/lib/github-query-updates";
import { reportMutationFailure } from "./mutation-failure";
import { StatusDisclosure, type StatusType } from "./status-row";

const CHECK_RUN_GROUPS: { state: CheckState; label: string }[] = [
	{ state: "expected", label: "Expected" },
	{ state: "failure", label: "Failed" },
	{ state: "pending", label: "Pending" },
	{ state: "waiting", label: "Waiting" },
	{ state: "skipped", label: "Skipped" },
	{ state: "success", label: "Passed" },
];

const CHECK_RUN_VERDICT: Record<
	CheckState,
	{ label: string; className?: string }
> = {
	success: { label: "Passed", className: "text-success" },
	failure: { label: "Failed", className: "text-danger" },
	pending: { label: "Pending", className: "text-pill-warning-text" },
	expected: { label: "Expected", className: "text-pill-warning-text" },
	skipped: { label: "Skipped", className: "text-muted-foreground" },
	waiting: { label: "Skipped" },
};

const plural = (count: number, noun: string) =>
	`${count} ${noun}${count !== 1 ? "s" : ""}`;

function checksSummary(
	checks: PullStatus["checks"],
	approvalCount: number,
): { status: StatusType; title: string; description: string } {
	const allPassed =
		checks.total > 0 &&
		checks.failed === 0 &&
		checks.pending === 0 &&
		checks.expected === 0;
	const status = allPassed
		? "success"
		: checks.failed > 0
			? "error"
			: "pending";

	if (checks.total === 0 && approvalCount > 0) {
		return {
			status,
			title: `${plural(approvalCount, "workflow")} awaiting approval`,
			description: "Approve to run workflows and report checks.",
		};
	}

	const pendingTotal = checks.pending + checks.expected;
	const parts: string[] = [];
	if (checks.skipped > 0) parts.push(`${checks.skipped} skipped`);
	parts.push(plural(checks.passed, "successful check"));
	if (checks.pending > 0) parts.push(`${checks.pending} pending`);
	if (checks.expected > 0) parts.push(`${checks.expected} expected`);
	if (checks.failed > 0) parts.push(`${checks.failed} failing`);

	return {
		status,
		title: allPassed
			? "All checks have passed"
			: checks.failed > 0
				? `${checks.failed} failing check${checks.failed > 1 ? "s" : ""}`
				: `${pendingTotal} pending check${pendingTotal > 1 ? "s" : ""}`,
		description: parts.join(", "),
	};
}

export function ChecksSection({
	scope,
	checks,
	checkRuns,
	pendingWorkflowApprovals,
	owner,
	repo,
	pullNumber,
}: {
	scope: GitHubQueryScope;
	checks: PullStatus["checks"];
	checkRuns: PullCheckRun[];
	pendingWorkflowApprovals: PullWorkflowApproval[];
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const [pendingAction, setPendingAction] = useState<
		"rerun" | "approve" | null
	>(null);
	const isRerunning = pendingAction === "rerun";
	const isApproving = pendingAction === "approve";
	const queryClient = useQueryClient();

	const hasCheckFailures = checks.failed > 0;
	const approvalCount = pendingWorkflowApprovals.length;

	const runsByState = useMemo(() => {
		const groups = new Map<CheckState, PullCheckRun[]>();
		for (const run of checkRuns) {
			const state = getCheckState(run);
			groups.set(state, [...(groups.get(state) ?? []), run]);
		}
		return groups;
	}, [checkRuns]);

	const handleRerun = async (failedOnly: boolean) => {
		setPendingAction("rerun");
		try {
			const result = await rerunChecks({
				data: { owner, repo, pullNumber, failedOnly },
			});
			if (result.ok) {
				const { rerun, skipped, failed } = result;
				if (failed > 0) {
					toast.warning(
						`Re-running ${plural(rerun, "check")}, but ${failed} failed`,
					);
				} else if (rerun > 0 && skipped > 0) {
					toast.success(
						`Re-running ${plural(rerun, "check")} · ${skipped} not eligible`,
					);
				} else if (rerun > 0) {
					toast.success(`Re-running ${plural(rerun, "check")}`);
				} else if (skipped > 0) {
					toast.info("No checks are eligible for rerun");
				}
				await invalidateGitHubEntities(queryClient, scope, [
					pullEntityKey({ owner, repo, pullNumber }),
				]);
			} else {
				reportMutationFailure(result, { owner, repo });
			}
		} catch {
			toast.error("Failed to rerun checks");
		} finally {
			setPendingAction(null);
		}
	};

	const handleApprove = async () => {
		setPendingAction("approve");
		try {
			const result = await approveWorkflowRuns({
				data: {
					owner,
					repo,
					pullNumber,
					workflowRunIds: pendingWorkflowApprovals.map((a) => a.workflowRunId),
				},
			});
			if (result.ok) {
				const { approved, failed } = result;
				if (failed > 0) {
					toast.warning(
						`Approved ${plural(approved, "workflow")}, but ${failed} failed`,
					);
				} else {
					toast.success(`Approved ${plural(approvalCount, "workflow")}`);
				}
				await queryClient.invalidateQueries({
					queryKey: githubQueryKeys.pulls.status(scope, {
						owner,
						repo,
						pullNumber,
					}),
					exact: true,
					refetchType: "active",
				});
			} else {
				reportMutationFailure(result, { owner, repo });
			}
		} catch {
			toast.error("Failed to approve workflows");
		} finally {
			setPendingAction(null);
		}
	};

	const rerunIcon = isRerunning ? (
		<Spinner size={12} />
	) : (
		<RefreshCwIcon size={12} strokeWidth={2} />
	);

	return (
		<StatusDisclosure
			{...checksSummary(checks, approvalCount)}
			defaultOpen={hasCheckFailures || approvalCount > 0}
			pinned={
				approvalCount > 0 && (
					<div className="flex items-start gap-3 border-b-[0.5px] border-card-border px-4 py-3">
						<div className="mt-0.5 shrink-0 text-pill-warning-text">
							<AlertCircleIcon size={16} strokeWidth={2} />
						</div>
						<div className="flex min-w-0 flex-1 flex-col gap-0.5">
							<p className="text-sm font-medium">
								{plural(approvalCount, "workflow")} awaiting approval
							</p>
							<p className="text-xs text-muted-foreground">
								This workflow requires approval from a maintainer.
							</p>
						</div>
						<Button
							size="xs"
							variant="outline"
							disabled={isApproving}
							className="shrink-0"
							iconLeft={isApproving ? <Spinner size={12} /> : undefined}
							onClick={() => void handleApprove()}
						>
							Approve workflows to run
						</Button>
					</div>
				)
			}
		>
			<div className="flex max-h-64 flex-col overflow-y-auto border-b-[0.5px] border-card-border bg-surface-1/50">
				{CHECK_RUN_GROUPS.map(({ state, label }) => {
					const runs = runsByState.get(state);
					if (!runs) return null;
					return (
						<div key={state} className="flex flex-col py-1">
							<div className="px-4 pt-1 pb-0.5 pl-11 text-[11px] font-medium text-muted-foreground">
								{label}
							</div>
							{runs.map((run) => (
								<CheckRunRow
									key={`${run.name}:${run.id}`}
									run={run}
									state={state}
									owner={owner}
									repo={repo}
									pullNumber={pullNumber}
								/>
							))}
						</div>
					);
				})}
			</div>
			{checks.total > 0 && (
				<div className="flex items-center gap-2 border-b-[0.5px] border-card-border px-4 py-1.5 pl-11">
					{hasCheckFailures && (
						<Button
							variant="ghost"
							size="xs"
							disabled={isRerunning}
							className="h-6 text-xs text-muted-foreground"
							iconLeft={rerunIcon}
							onClick={() => void handleRerun(true)}
						>
							Re-run failed checks
						</Button>
					)}
					<Button
						variant="ghost"
						size="xs"
						disabled={isRerunning}
						className="h-6 text-xs text-muted-foreground"
						iconLeft={rerunIcon}
						onClick={() => void handleRerun(false)}
					>
						Re-run all checks
					</Button>
				</div>
			)}
		</StatusDisclosure>
	);
}

function CheckRunRow({
	run,
	state,
	owner,
	repo,
	pullNumber,
}: {
	run: PullCheckRun;
	state: CheckState;
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const detail =
		state === "expected"
			? "Waiting for status to be reported"
			: state === "pending" && run.startedAt
				? `Started ${formatRelativeTime(run.startedAt)}`
				: run.outputTitle;
	const name = (
		<>
			<span>{run.name}</span>
			{detail && (
				<span className="text-muted-foreground">
					{" — "}
					{detail}
				</span>
			)}
		</>
	);
	const verdict = CHECK_RUN_VERDICT[state];

	return (
		<div className="group/run flex items-center gap-2 px-4 py-1.5 pl-11">
			<CheckStateIcon state={state} />
			{run.appAvatarUrl && (
				<img
					src={run.appAvatarUrl}
					alt=""
					className="size-4 shrink-0 rounded border-[0.5px] border-border"
				/>
			)}
			{run.workflowRunId != null ? (
				<Link
					to="/$owner/$repo/actions/runs/$runId"
					params={{ owner, repo, runId: String(run.workflowRunId) }}
					search={{ pr: pullNumber }}
					className="min-w-0 flex-1 truncate text-xs hover:underline"
				>
					{name}
				</Link>
			) : run.htmlUrl ? (
				<a
					href={run.htmlUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="min-w-0 flex-1 truncate text-xs hover:underline"
				>
					{name}
				</a>
			) : (
				<span className="min-w-0 flex-1 truncate text-xs">{name}</span>
			)}
			{run.required && (
				<StatePill
					tone="muted"
					className="-my-0.5 border-[0.5px] border-border bg-transparent"
				>
					Required
				</StatePill>
			)}
			<span className={cn("shrink-0 text-xs capitalize", verdict.className)}>
				{verdict.label}
			</span>
		</div>
	);
}
