import {
	CheckIcon,
	CopyIcon,
	EditIcon,
	MoreHorizontalIcon,
} from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { Markdown } from "@diffkit/ui/components/markdown";
import { MarkdownEditor } from "@diffkit/ui/components/markdown-editor";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useState } from "react";
import { IssueCommentReactionBar } from "#/components/details/comment-reaction-bar";
import { updatePullBody } from "#/lib/github.functions";
import { type GitHubQueryScope, githubQueryKeys } from "#/lib/github.query";
import type { PullDetail, PullPageData } from "#/lib/github.types";
import { useOptimisticMutation } from "#/lib/use-optimistic-mutation";
import { usePrefersNoHover } from "#/lib/use-prefers-no-hover";

export function PullBodySection({
	pr,
	owner,
	repo,
	pullNumber,
	isAuthor,
	scope,
	viewerLogin,
}: {
	pr: PullDetail;
	owner: string;
	repo: string;
	pullNumber: number;
	isAuthor: boolean;
	scope: GitHubQueryScope;
	viewerLogin?: string | null;
}) {
	const { mutate } = useOptimisticMutation();
	const [bodyActive, setBodyActive] = useState(false);
	const prefersNoHover = usePrefersNoHover();
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(pr.body);
	const [isSaving, setIsSaving] = useState(false);

	const pageQueryKey = githubQueryKeys.pulls.page(scope, {
		owner,
		repo,
		pullNumber,
	});

	const startEditing = () => {
		setDraft(pr.body);
		setIsEditing(true);
	};

	const saveBody = async () => {
		setIsSaving(true);
		try {
			await mutate({
				mutationFn: () =>
					updatePullBody({
						data: { owner, repo, pullNumber, body: draft },
					}),
				updates: [
					{
						queryKey: pageQueryKey,
						updater: (prev: PullPageData) => ({
							...prev,
							detail: prev.detail
								? { ...prev.detail, body: draft }
								: prev.detail,
						}),
					},
				],
			});
			setIsEditing(false);
		} finally {
			setIsSaving(false);
		}
	};

	if (isEditing) {
		return (
			<div className="flex flex-col gap-2">
				<MarkdownEditor
					value={draft}
					onChange={setDraft}
					placeholder="Write a description..."
				/>
				<div className="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onClick={() => setIsEditing(false)}
						disabled={isSaving}
						className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={saveBody}
						disabled={isSaving}
						className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
					>
						{isSaving ? (
							<Spinner size={13} />
						) : (
							<CheckIcon size={13} strokeWidth={2.5} />
						)}
						Save
					</button>
				</div>
			</div>
		);
	}

	const hasDropdownOptions = !!pr.body || isAuthor;

	return (
		<div className="relative rounded-lg border bg-surface-0 p-5">
			{hasDropdownOptions && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="absolute right-3 top-3 z-20 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
						>
							<MoreHorizontalIcon size={15} strokeWidth={2} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-44">
						{pr.body && (
							<DropdownMenuItem
								onSelect={() => {
									void navigator.clipboard.writeText(pr.body);
								}}
							>
								<CopyIcon size={14} strokeWidth={2} />
								Copy as Markdown
							</DropdownMenuItem>
						)}
						{isAuthor && (
							<DropdownMenuItem onSelect={startEditing}>
								<EditIcon size={14} strokeWidth={2} />
								Edit
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<div
				className="flex flex-col"
				onPointerEnter={() => setBodyActive(true)}
				onPointerLeave={() => setBodyActive(false)}
				onFocusCapture={() => setBodyActive(true)}
				onBlurCapture={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
						setBodyActive(false);
					}
				}}
			>
				{pr.body ? (
					<Markdown>{pr.body}</Markdown>
				) : (
					<p className="text-sm italic text-muted-foreground">
						No description provided.
					</p>
				)}
				{pr.graphqlId ? (
					<IssueCommentReactionBar
						className="mt-3 justify-start"
						revealZeroCount={bodyActive || prefersNoHover}
						viewerLogin={viewerLogin}
						owner={owner}
						repo={repo}
						issueNumber={pullNumber}
						commentGraphqlId={pr.graphqlId}
						scope={scope}
						reactions={pr.reactions}
						variant="detail"
						detailPage="pull"
					/>
				) : null}
			</div>
		</div>
	);
}
