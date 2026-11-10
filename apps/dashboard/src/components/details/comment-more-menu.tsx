import {
	CopyIcon,
	Delete01Icon,
	EditIcon,
	LinkIcon,
	MoreHorizontalIcon,
	ViewIcon,
} from "@diffkit/icons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@diffkit/ui/components/alert-dialog";
import { buttonVariants } from "@diffkit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { toast } from "@diffkit/ui/components/sonner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import { minimizeComment } from "#/lib/github.functions";
import { githubRepoViewerPermissionQueryOptions } from "#/lib/github.query";
import {
	invalidateGitHubEntities,
	pullOrIssueEntityKeys,
} from "#/lib/github-query-updates";
import { useGitHubQueryScope } from "#/lib/use-github-query-scope";
import type { CommentEditor } from "./comment-body";

type CommentMoreMenuProps = {
	commentId: number;
	body: string;
	owner: string;
	repo: string;
	number: number;
	commentType: "issue" | "review";
	isAuthor: boolean;
	editor: CommentEditor;
};

/** GitHub lets the author and anyone with write access edit, hide or delete. */
function useCanModerate(owner: string, repo: string, isAuthor: boolean) {
	const scope = useGitHubQueryScope();
	const isSample = useIsSkeletonSample();
	const permission = useQuery({
		...githubRepoViewerPermissionQueryOptions(scope, { owner, repo }),
		enabled: !isAuthor && !isSample,
	});
	// Read on every render so the query only notifies when the permission itself changes.
	const canPush = permission.data?.canPush === true;
	return isAuthor || canPush;
}

export function CommentMoreMenu({
	commentId,
	body,
	owner,
	repo,
	number,
	commentType,
	isAuthor,
	editor,
}: CommentMoreMenuProps) {
	const queryClient = useQueryClient();
	const canModerate = useCanModerate(owner, repo, isAuthor);
	const [deleteDialog, setDeleteDialog] = useState<"closed" | "confirming">(
		"closed",
	);

	const commentUrl = `https://github.com/${owner}/${repo}/${commentType === "review" ? "pull" : "issues"}/${number}#${commentType === "review" ? "discussion_r" : "issuecomment-"}${commentId}`;

	const handleCopyLink = () => {
		void navigator.clipboard.writeText(commentUrl);
		toast.success("Link copied");
	};

	const handleCopyMarkdown = () => {
		void navigator.clipboard.writeText(body);
		toast.success("Markdown copied");
	};

	const handleHide = async () => {
		const result = await minimizeComment({
			data: { owner, repo, commentId, commentType },
		}).catch(() => null);
		if (!result?.ok) {
			toast.error(result?.error ?? "Failed to hide comment");
			return;
		}
		toast.success("Comment hidden");
		void invalidateGitHubEntities(
			queryClient,
			null,
			pullOrIssueEntityKeys({ owner, repo, number }),
		);
	};

	const handleDelete = async () => {
		setDeleteDialog("closed");
		const result = await editor.remove();
		if (!result.ok) toast.error(result.error);
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label="Comment actions"
						className={cn(
							"rounded-md p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-ghost-hover hover:text-foreground group-hover/comment:opacity-100 focus-visible:opacity-100",
							"data-[state=open]:opacity-100",
						)}
					>
						<MoreHorizontalIcon size={14} strokeWidth={2} />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-[160px]">
					<DropdownMenuItem onClick={handleCopyLink}>
						<LinkIcon size={14} strokeWidth={2} />
						Copy link
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handleCopyMarkdown}>
						<CopyIcon size={14} strokeWidth={2} />
						Copy Markdown
					</DropdownMenuItem>
					{canModerate && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={() => editor.start(body)}>
								<EditIcon size={14} strokeWidth={2} />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => void handleHide()}>
								<ViewIcon size={14} strokeWidth={2} />
								Hide
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setDeleteDialog("confirming")}
								variant="destructive"
							>
								<Delete01Icon size={14} strokeWidth={2} />
								Delete
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<AlertDialog
				open={deleteDialog === "confirming"}
				onOpenChange={(open) => setDeleteDialog(open ? "confirming" : "closed")}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this comment?</AlertDialogTitle>
						<AlertDialogDescription>
							It's removed from GitHub for everyone. This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className={buttonVariants({ variant: "destructive" })}
							onClick={() => void handleDelete()}
						>
							Delete comment
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
