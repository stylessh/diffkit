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
import { deleteRepoRelease } from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type { RepoRelease } from "#/lib/github.types";

const iconButtonClass =
	"flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground";

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
	const [open, setOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const handleDelete = async () => {
		setDeleting(true);
		try {
			const result = await deleteRepoRelease({
				data: { owner, repo, releaseId: release.id },
			});
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			setOpen(false);
			toast.success(`Deleted release ${release.tagName}`, {
				description: "The git tag was kept.",
			});
			onDeleted?.();
			await queryClient.invalidateQueries({
				queryKey: githubQueryKeys.releases.repo(scope, { owner, repo }),
			});
		} catch {
			toast.error("Failed to delete release");
		} finally {
			setDeleting(false);
		}
	};

	const trigger =
		variant === "icon" ? (
			<button
				type="button"
				aria-label={`Delete release ${release.tagName}`}
				className={cn(iconButtonClass, "hover:text-destructive")}
			>
				<Delete01Icon size={14} />
			</button>
		) : (
			<button
				type="button"
				className={cn(
					buttonVariants({ variant: "ghost", size: "sm" }),
					"text-destructive hover:bg-destructive/10 hover:text-destructive",
				)}
			>
				<Delete01Icon size={14} />
				Delete release
			</button>
		);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
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
