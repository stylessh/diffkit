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
import { MarkdownEditor } from "@diffkit/ui/components/markdown-editor";
import { Spinner } from "@diffkit/ui/components/spinner";
import { useState } from "react";
import { IssueCommentReactionBar } from "#/components/details/comment-reaction-bar";
import { AppMarkdown } from "#/components/markdown/app-markdown";
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
	const [mode, setMode] = useState<"viewing" | "editing" | "saving">("viewing");
	const isEditing = mode !== "viewing";
	const isSaving = mode === "saving";
	const [draft, setDraft] = useState(pr.body);

	const pageQueryKey = githubQueryKeys.pulls.page(scope, {
		owner,
		repo,
		pullNumber,
	});

	const startEditing = () => {
		setDraft(pr.body);
		setMode("editing");
	};

	const saveBody = async () => {
		setMode("saving");
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
			setMode("viewing");
		} catch (error) {
			setMode("editing");
			throw error;
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
						onClick={() => setMode("viewing")}
						disabled={isSaving}
						className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={saveBody}
						disabled={isSaving}
						className="flex h-7 items-center gap-1.5 rounded-md bg-indigo px-3 text-xs font-medium text-indigo-foreground shadow-[0_1px_1px_0_lch(0_0_0/0.12),0_3px_6px_-2px_lch(0_0_0/0.12)] transition-colors hover:bg-indigo/90 disabled:opacity-50"
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
		<div className="relative">
			{hasDropdownOptions && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="absolute -top-1 right-0 z-20 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
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
					<AppMarkdown
						owner={owner}
						repo={repo}
						className="text-[15px] leading-6 text-text-header"
					>
						{pr.body}
					</AppMarkdown>
				) : (
					<p className="text-sm italic text-muted-foreground">
						No description provided.
					</p>
				)}
				{pr.graphqlId ? (
					<IssueCommentReactionBar
						className="mt-3 min-h-6 justify-start"
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
