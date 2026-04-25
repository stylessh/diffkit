import {
	ChevronLeftIcon,
	ExternalLinkIcon,
	MoreHorizontalIcon,
	RefreshCwIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	CheckStateIcon,
	getCheckState,
} from "#/components/checks/check-state-icon";
import {
	rerunFailedWorkflowJobs,
	rerunWorkflowRun,
} from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type { WorkflowRun } from "#/lib/github.types";

export function WorkflowRunHeader({
	owner,
	repo,
	run,
	pullRequestNumber,
	scope,
}: {
	owner: string;
	repo: string;
	run: WorkflowRun;
	pullRequestNumber: number | null;
	scope: GitHubQueryScope;
}) {
	const queryClient = useQueryClient();
	const [rerunPending, setRerunPending] = useState<"all" | "failed" | null>(
		null,
	);

	const state = getCheckState(run);
	const failedOnly = state === "failure";
	const canRerun = run.viewerCanRerun;

	const invalidateAfterRerun = async () => {
		const runInput = { owner, repo, runId: run.id };
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: githubQueryKeys.actions.workflowRun(scope, runInput),
			}),
			queryClient.invalidateQueries({
				queryKey: githubQueryKeys.actions.workflowRunJobs(scope, runInput),
			}),
			queryClient.invalidateQueries({
				queryKey: githubQueryKeys.actions.workflowRunArtifacts(scope, runInput),
			}),
			pullRequestNumber
				? queryClient.invalidateQueries({
						queryKey: githubQueryKeys.pulls.status(scope, {
							owner,
							repo,
							pullNumber: pullRequestNumber,
						}),
					})
				: Promise.resolve(),
		]);
	};

	const handleRerun = async (mode: "all" | "failed") => {
		setRerunPending(mode);
		try {
			const result =
				mode === "failed"
					? await rerunFailedWorkflowJobs({
							data: { owner, repo, runId: run.id },
						})
					: await rerunWorkflowRun({
							data: { owner, repo, runId: run.id },
						});
			if (result.ok) {
				toast.success(
					mode === "failed" ? "Re-running failed jobs" : "Re-running all jobs",
				);
				await invalidateAfterRerun();
			} else {
				toast.error(result.error);
			}
		} catch {
			toast.error("Failed to re-run workflow");
		} finally {
			setRerunPending(null);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			{pullRequestNumber != null ? (
				<Link
					to="/$owner/$repo/pull/$pullId"
					params={{ owner, repo, pullId: String(pullRequestNumber) }}
					className="flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronLeftIcon size={13} strokeWidth={2} />
					Back to pull request #{pullRequestNumber}
				</Link>
			) : (
				<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Link
						to="/$owner/$repo"
						params={{ owner, repo }}
						className="transition-colors hover:text-foreground"
					>
						{owner}/{repo}
					</Link>
					<span>/</span>
					<span>Actions</span>
					<span>/</span>
					<span>#{run.runNumber}</span>
				</div>
			)}

			<div className="flex items-start gap-3">
				<div className="mt-1 shrink-0">
					<CheckStateIcon state={state} />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<h1 className="flex flex-wrap items-baseline gap-x-2 text-xl font-semibold tracking-tight">
						<span className="min-w-0 truncate">{run.displayTitle}</span>
						<span className="font-normal text-muted-foreground">
							#{run.runNumber}
						</span>
					</h1>
					{run.name && run.name !== run.displayTitle ? (
						<p className="text-sm text-muted-foreground">{run.name}</p>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{canRerun ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleRerun(failedOnly ? "failed" : "all")}
							disabled={rerunPending !== null}
						>
							{rerunPending !== null ? (
								<Spinner className="size-3.5" />
							) : (
								<RefreshCwIcon size={14} strokeWidth={2} />
							)}
							{failedOnly ? "Re-run failed jobs" : "Re-run all jobs"}
						</Button>
					) : null}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="px-2"
								aria-label="More actions"
							>
								<MoreHorizontalIcon size={14} strokeWidth={2} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{canRerun ? (
								<>
									<DropdownMenuItem
										disabled={rerunPending !== null || state !== "failure"}
										onSelect={() => handleRerun("failed")}
									>
										<RefreshCwIcon size={14} strokeWidth={2} />
										Re-run failed jobs
									</DropdownMenuItem>
									<DropdownMenuItem
										disabled={rerunPending !== null}
										onSelect={() => handleRerun("all")}
									>
										<RefreshCwIcon size={14} strokeWidth={2} />
										Re-run all jobs
									</DropdownMenuItem>
								</>
							) : null}
							<DropdownMenuItem asChild>
								<a href={run.htmlUrl} target="_blank" rel="noopener noreferrer">
									<ExternalLinkIcon size={14} strokeWidth={2} />
									View on GitHub
								</a>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}
