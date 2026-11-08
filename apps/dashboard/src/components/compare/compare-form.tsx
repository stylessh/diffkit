import { GitPullRequestIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { Checkbox } from "@diffkit/ui/components/checkbox";
import {
	MarkdownEditor,
	type MentionConfig,
} from "@diffkit/ui/components/markdown-editor";
import { Spinner } from "@diffkit/ui/components/spinner";
import { Link } from "@tanstack/react-router";
import type { Dispatch, SetStateAction } from "react";

export type SubmitState =
	| { status: "idle" }
	| { status: "submitting" }
	| { status: "failed"; message: string };

export function CompareForm({
	owner,
	repo,
	title,
	body,
	isDraft,
	submit,
	canSubmit,
	mentionConfig,
	onTitleChange,
	onBodyChange,
	onDraftChange,
	onSubmit,
}: {
	owner: string;
	repo: string;
	title: string;
	body: string;
	isDraft: boolean;
	submit: SubmitState;
	canSubmit: boolean;
	mentionConfig?: MentionConfig;
	onTitleChange: (value: string) => void;
	onBodyChange: (value: string) => void;
	onDraftChange: (value: boolean) => void;
	onSubmit: () => void;
}) {
	const submitting = submit.status === "submitting";
	const setBody: Dispatch<SetStateAction<string>> = (next) =>
		onBodyChange(typeof next === "function" ? next(body) : next);

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (canSubmit && !submitting) onSubmit();
			}}
		>
			<div className="flex flex-col gap-2">
				<label
					htmlFor="pr-title"
					className="text-[13px] font-[450] text-muted-foreground"
				>
					Title
				</label>
				<input
					id="pr-title"
					value={title}
					onChange={(event) => onTitleChange(event.target.value)}
					placeholder="Pull request title"
					className="flex h-9 w-full rounded-lg bg-surface-0 px-3 text-[13px] font-[450] text-foreground shadow-field outline-none placeholder:text-muted-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
				/>
			</div>

			<div className="compact-md-editor flex flex-col gap-2 [&_[class*='min-h-\[640px\]']]:!min-h-[20rem]">
				<span className="text-[13px] font-[450] text-muted-foreground">
					Description
				</span>
				<MarkdownEditor
					value={body}
					onChange={setBody}
					placeholder="Describe the changes…"
					mentions={mentionConfig}
				/>
			</div>

			{submit.status === "failed" ? (
				<div
					role="alert"
					className="rounded-lg bg-pill-blocked px-4 py-3 text-[13px] font-[450] text-pill-blocked-text"
				>
					{submit.message}
				</div>
			) : null}

			<div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
				<label
					htmlFor="pr-draft"
					className="mr-auto flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] font-[450] text-text-header"
				>
					<Checkbox
						id="pr-draft"
						checked={isDraft}
						disabled={submitting}
						onCheckedChange={(checked) => onDraftChange(checked === true)}
					/>
					Create as draft
				</label>
				<Button asChild variant="ghost" size="sm">
					<Link to="/$owner/$repo" params={{ owner, repo }}>
						Cancel
					</Link>
				</Button>
				<Button
					type="submit"
					variant="accent"
					size="sm"
					disabled={!canSubmit || submitting}
					iconLeft={
						submitting ? (
							<Spinner size={13} />
						) : (
							<GitPullRequestIcon size={14} strokeWidth={2} />
						)
					}
				>
					{isDraft ? "Create draft pull request" : "Create pull request"}
				</Button>
			</div>
		</form>
	);
}
