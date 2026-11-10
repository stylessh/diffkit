import { Delete01Icon, GitMergeIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useState } from "react";
import { deleteBranch } from "#/lib/github.functions";
import { reportMutationFailure } from "./mutation-failure";

export function MergedBranchBanner({
	owner,
	repo,
	pullNumber,
	branchName,
	headRefDeleted,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
	branchName: string;
	headRefDeleted: boolean;
}) {
	const [branchStatus, setBranchStatus] = useState<
		"present" | "deleting" | "deleted"
	>("present");
	const isDeleting = branchStatus === "deleting";
	const deleted = headRefDeleted || branchStatus === "deleted";

	const handleDelete = async () => {
		setBranchStatus("deleting");
		try {
			const result = await deleteBranch({
				data: { owner, repo, branch: branchName, pullNumber },
			});
			if (result.ok) {
				setBranchStatus("deleted");
			} else {
				reportMutationFailure(result, { owner, repo });
				setBranchStatus("present");
			}
		} catch {
			toast.error("Failed to delete branch");
			setBranchStatus("present");
		}
	};

	return (
		<div className="flex items-center gap-3 rounded-lg bg-pill-merged px-4 py-3">
			<div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-merged text-white">
				<GitMergeIcon size={12} strokeWidth={2} />
			</div>
			<p className="flex-1 text-[13px] text-pill-merged-text">
				Branch{" "}
				<code className="rounded bg-pill-merged px-1 py-0.5 font-mono text-xs">
					{branchName}
				</code>{" "}
				{deleted ? "has been deleted." : "has been merged."}
			</p>
			{!deleted && (
				<Button
					variant="ghost"
					size="xs"
					disabled={isDeleting}
					className="shrink-0 text-pill-merged-text hover:bg-pill-merged"
					iconLeft={
						isDeleting ? (
							<Spinner size={12} />
						) : (
							<Delete01Icon size={12} strokeWidth={2} />
						)
					}
					onClick={() => {
						void handleDelete();
					}}
				>
					Delete branch
				</Button>
			)}
		</div>
	);
}
