import { CommentIcon } from "@diffkit/icons";
import {
	MarkdownEditor,
	type MarkdownEditorHandle,
} from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useCommentMediaUpload } from "#/hooks/use-comment-media-upload";
import { createComment } from "#/lib/github.functions";
import { githubQueryKeys } from "#/lib/github.query";
import { checkPermissionWarning } from "#/lib/warning-store";

export function CommentReplyForm({
	owner,
	repo,
	issueNumber,
	parentAuthor,
	parentBody,
	parentCommentId,
	onClose,
}: {
	owner: string;
	repo: string;
	issueNumber: number;
	parentAuthor: string;
	parentBody: string;
	parentCommentId: number;
	onClose: () => void;
}) {
	const [value, setValue] = useState("");
	const [isSending, setIsSending] = useState(false);
	const queryClient = useQueryClient();
	const editorRef = useRef<MarkdownEditorHandle>(null);
	const commentActionsRef = useRef<HTMLDivElement>(null);
	const { media: mediaUpload, onPaste: onMediaPaste } =
		useCommentMediaUpload(editorRef);

	const handleSend = useCallback(async () => {
		if (!value.trim()) return;
		setIsSending(true);

		const firstLines = parentBody
			.split("\n")
			.slice(0, 3)
			.map((l) => `> ${l}`)
			.join("\n");
		const quoteBlock = `> **@${parentAuthor}** [commented](#issuecomment-${parentCommentId}):\n${firstLines}\n\n`;

		try {
			const result = await createComment({
				data: {
					owner,
					repo,
					issueNumber,
					body: quoteBlock + value.trim(),
				},
			});
			if (result.ok) {
				setValue("");
				onClose();
				void queryClient.invalidateQueries({
					queryKey: githubQueryKeys.all,
				});
			} else {
				toast.error(result.error);
				checkPermissionWarning(result, `${owner}/${repo}`);
			}
		} catch {
			toast.error("Failed to send reply");
		} finally {
			setIsSending(false);
		}
	}, [
		value,
		parentAuthor,
		parentBody,
		parentCommentId,
		owner,
		repo,
		issueNumber,
		onClose,
		queryClient,
	]);

	return (
		<div className="flex w-full flex-col gap-2 pt-2">
			<MarkdownEditor
				ref={editorRef}
				scrollAnchorRef={commentActionsRef}
				value={value}
				onChange={setValue}
				placeholder={`Reply to @${parentAuthor}...`}
				compact
				media={mediaUpload}
				onPaste={onMediaPaste}
			/>
			<div
				ref={commentActionsRef}
				className="flex items-center justify-end gap-2"
			>
				<button
					type="button"
					onClick={() => {
						setValue("");
						onClose();
					}}
					className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={() => void handleSend()}
					disabled={!value.trim() || isSending}
					className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity disabled:opacity-50"
				>
					{isSending ? (
						<Spinner className="size-3" />
					) : (
						<CommentIcon size={12} strokeWidth={2} />
					)}
					Reply
				</button>
			</div>
		</div>
	);
}
