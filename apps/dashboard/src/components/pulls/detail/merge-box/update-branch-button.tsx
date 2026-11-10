import { CheckIcon, ChevronDownIcon, RefreshCwIcon } from "@diffkit/icons";
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
import { useState } from "react";
import { updatePullBranch } from "#/lib/github.functions";
import {
	invalidateGitHubEntities,
	pullEntityKey,
	repoEntityKey,
} from "#/lib/github-query-updates";
import { reportMutationFailure } from "./mutation-failure";

export function UpdateBranchButton({
	owner,
	repo,
	pullNumber,
}: {
	owner: string;
	repo: string;
	pullNumber: number;
}) {
	const [isUpdating, setIsUpdating] = useState(false);
	const queryClient = useQueryClient();

	// Stays busy after a success: the refreshed status drops this button.
	const handleUpdate = async () => {
		setIsUpdating(true);
		try {
			const result = await updatePullBranch({
				data: { owner, repo, pullNumber },
			});
			if (result.ok) {
				await invalidateGitHubEntities(queryClient, null, [
					pullEntityKey({ owner, repo, pullNumber }),
					repoEntityKey({ owner, repo }),
				]);
			} else {
				reportMutationFailure(result, { owner, repo });
				setIsUpdating(false);
			}
		} catch {
			toast.error("Failed to update branch");
			setIsUpdating(false);
		}
	};

	return (
		<div className="flex overflow-hidden rounded-md shadow-button">
			<Button
				variant="outline"
				size="xs"
				disabled={isUpdating}
				className="rounded-r-none"
				iconLeft={
					isUpdating ? (
						<Spinner size={12} />
					) : (
						<RefreshCwIcon size={12} strokeWidth={2} />
					)
				}
				onClick={() => {
					void handleUpdate();
				}}
			>
				Update branch
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="xs"
						disabled={isUpdating}
						className="rounded-l-none border-l-[0.5px] border-l-secondary-foreground/10 px-1"
					>
						<ChevronDownIcon size={12} strokeWidth={2} />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-72">
					<DropdownMenuItem
						onClick={() => {
							void handleUpdate();
						}}
					>
						<div className="flex flex-col gap-0.5">
							<span className="flex items-center gap-1.5 font-medium">
								<CheckIcon size={12} strokeWidth={2} />
								Update with merge commit
							</span>
							<span className="pl-[18px] text-xs text-muted-foreground">
								The merge commit will be associated with your account.
							</span>
						</div>
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => {
							void handleUpdate();
						}}
					>
						<div className="flex flex-col gap-0.5">
							<span className="pl-[18px] font-medium">Update with rebase</span>
							<span className="pl-[18px] text-xs text-muted-foreground">
								This pull request will be rebased on top of the latest changes
								and then force pushed.
							</span>
						</div>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
