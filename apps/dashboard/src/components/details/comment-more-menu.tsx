import {
	CopyIcon,
	Delete01Icon,
	EditIcon,
	LinkIcon,
	MoreHorizontalIcon,
	ViewIcon,
} from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	deleteComment,
	deleteReviewComment,
	minimizeComment,
} from "#/lib/github.functions";
import { githubQueryKeys } from "#/lib/github.query";

type CommentMoreMenuProps = {
	commentId: number;
	body: string;
	owner: string;
	repo: string;
	number: number;
	commentType: "issue" | "review";
	isAuthor: boolean;
	onStartEdit?: () => void;
};

export function CommentMoreMenu({
	commentId,
	body,
	owner,
	repo,
	number,
	commentType,
	isAuthor,
	onStartEdit,
}: CommentMoreMenuProps) {
	const queryClient = useQueryClient();
	const [isDeleting, setIsDeleting] = useState(false);
	const [isHiding, setIsHiding] = useState(false);

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
		setIsHiding(true);
		try {
			const result = await minimizeComment({
				data: { owner, repo, commentId, commentType },
			});
			if (result.ok) {
				toast.success("Comment hidden");
				void queryClient.invalidateQueries({
					queryKey: githubQueryKeys.all,
				});
			} else {
				toast.error(result.error);
			}
		} catch {
			toast.error("Failed to hide comment");
		} finally {
			setIsHiding(false);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const deleteFn =
				commentType === "review" ? deleteReviewComment : deleteComment;
			const result = await deleteFn({
				data: { owner, repo, commentId },
			});
			if (result.ok) {
				toast.success("Comment deleted");
				void queryClient.invalidateQueries({
					queryKey: githubQueryKeys.all,
				});
			} else {
				toast.error(result.error);
			}
		} catch {
			toast.error("Failed to delete comment");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"rounded-md p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-surface-2 hover:text-foreground group-hover/comment:opacity-100",
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
				{isAuthor && (
					<>
						<DropdownMenuSeparator />
						{onStartEdit && (
							<DropdownMenuItem onClick={onStartEdit}>
								<EditIcon size={14} strokeWidth={2} />
								Edit
							</DropdownMenuItem>
						)}
						<DropdownMenuItem
							onClick={() => void handleHide()}
							disabled={isHiding}
						>
							{isHiding ? (
								<Spinner className="size-3.5" />
							) : (
								<ViewIcon size={14} strokeWidth={2} />
							)}
							Hide
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => void handleDelete()}
							disabled={isDeleting}
							variant="destructive"
						>
							{isDeleting ? (
								<Spinner className="size-3.5" />
							) : (
								<Delete01Icon size={14} strokeWidth={2} />
							)}
							Delete
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
