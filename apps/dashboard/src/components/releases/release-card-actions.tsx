import { Delete01Icon, EditIcon } from "@diffkit/icons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@diffkit/ui/components/alert-dialog";
import { buttonVariants } from "@diffkit/ui/components/button";
import { toast } from "@diffkit/ui/components/sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { iconButtonClassName } from "#/components/repo/repo-ui";
import { deleteRepoRelease } from "#/lib/github.functions";
import type { GitHubQueryScope } from "#/lib/github.query";
import type { RepoRelease } from "#/lib/github.types";
import {
	invalidateGitHubEntities,
	releaseEntityKey,
} from "#/lib/github-query-updates";

const iconButtonClass = iconButtonClassName;

/** Edit / delete controls, rendered only for viewers with push access. */
export function ReleaseCardActions({
	owner,
	repo,
	scope,
	release,
	onDeleted,
	className,
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	release: RepoRelease;
	onDeleted?: () => void;
	className?: string;
}) {
	return (
		<div className={cn("flex shrink-0 items-center gap-0.5", className)}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Link
						to="/$owner/$repo/releases/$tag/edit"
						params={{ owner, repo, tag: release.tagName }}
						aria-label={`Edit release ${release.tagName}`}
						className={iconButtonClass}
					>
						<EditIcon size={14} />
					</Link>
				</TooltipTrigger>
				<TooltipContent>Edit release</TooltipContent>
			</Tooltip>
			<ReleaseDeleteButton
				owner={owner}
				repo={repo}
				scope={scope}
				release={release}
				onDeleted={onDeleted}
			/>
		</div>
	);
}

/** Confirm-and-delete control; `variant="button"` renders a labelled button for forms. */
export function ReleaseDeleteButton({
	owner,
	repo,
	scope,
	release,
	onDeleted,
	variant = "icon",
}: {
	owner: string;
	repo: string;
	scope: GitHubQueryScope;
	release: RepoRelease;
	onDeleted?: () => void;
	variant?: "icon" | "button";
}) {
	const queryClient = useQueryClient();
	const [dialog, setDialog] = useState<"closed" | "confirming" | "deleting">(
		"closed",
	);
	const deleting = dialog === "deleting";

	const handleDelete = async () => {
		setDialog("deleting");
		try {
			const result = await deleteRepoRelease({
				data: { owner, repo, releaseId: release.id },
			});
			if (!result.ok) {
				toast.error(result.error);
				setDialog("confirming");
				return;
			}
			setDialog("closed");
			toast.success(`Deleted release ${release.tagName}`, {
				description: "The git tag was kept.",
			});
			onDeleted?.();
			await invalidateGitHubEntities(queryClient, scope, [
				releaseEntityKey({ owner, repo }),
			]);
		} catch {
			toast.error("Failed to delete release");
			setDialog("confirming");
		}
	};

	const trigger =
		variant === "icon" ? (
			<button
				type="button"
				aria-label={`Delete release ${release.tagName}`}
				className={cn(iconButtonClass, "hover:text-danger")}
			>
				<Delete01Icon size={14} />
			</button>
		) : (
			<button
				type="button"
				className={cn(
					buttonVariants({ variant: "ghost", size: "sm" }),
					"rounded-md text-danger hover:bg-pill-blocked hover:text-danger",
				)}
			>
				<Delete01Icon size={14} />
				Delete release
			</button>
		);

	return (
		<AlertDialog
			open={dialog !== "closed"}
			onOpenChange={(open) => {
				if (!deleting) setDialog(open ? "confirming" : "closed");
			}}
		>
			{variant === "icon" ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
					</TooltipTrigger>
					<TooltipContent>Delete release</TooltipContent>
				</Tooltip>
			) : (
				<AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
			)}
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete release {release.tagName}?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently removes{" "}
						<span className="font-medium text-foreground">{release.name}</span>{" "}
						and its uploaded assets. The git tag stays in the repository.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={deleting}
						className={buttonVariants({ variant: "destructive" })}
						onClick={(event) => {
							event.preventDefault();
							void handleDelete();
						}}
					>
						{deleting ? "Deleting…" : "Delete release"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
