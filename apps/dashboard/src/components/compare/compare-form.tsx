import {
	ChevronDownIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import {
	MarkdownEditor,
	type MentionConfig,
} from "@diffkit/ui/components/markdown-editor";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type Dispatch, type SetStateAction, useRef, useState } from "react";

export function CompareForm({
	title,
	body,
	onTitleChange,
	onBodyChange,
	onSubmit,
	submitting,
	error,
	canSubmit,
	mentionConfig,
	owner,
	repo,
}: {
	title: string;
	body: string;
	onTitleChange: (v: string) => void;
	onBodyChange: Dispatch<SetStateAction<string>>;
	onSubmit: (draft: boolean) => void;
	submitting: boolean;
	error: string | null;
	canSubmit: boolean;
	mentionConfig?: MentionConfig;
	owner: string;
	repo: string;
}) {
	const [draftMode, setDraftMode] = useState(false);
	const titleRef = useRef<HTMLInputElement>(null);
	const label = draftMode ? "Create draft pull request" : "Create pull request";

	const handleExecute = () => {
		if (submitting) return;
		if (!title.trim()) {
			titleRef.current?.focus();
			return;
		}
		if (!canSubmit) return;
		onSubmit(draftMode);
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<label
					htmlFor="pr-title"
					className="text-sm font-medium text-foreground"
				>
					Title <span className="text-destructive">*</span>
				</label>
				<input
					id="pr-title"
					ref={titleRef}
					value={title}
					onChange={(e) => onTitleChange(e.target.value)}
					onKeyDown={(event) => {
						if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
							event.preventDefault();
							handleExecute();
						}
					}}
					placeholder="Pull request title"
					// biome-ignore lint/a11y/noAutofocus: intentional — this is a dedicated PR-creation page
					autoFocus
					className="flex h-9 w-full rounded-md border bg-surface-1 px-3 py-1 text-sm outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
				/>
			</div>

			<div className="compact-md-editor flex flex-col gap-2 [&_[class*='min-h-\[640px\]']]:!min-h-[20rem]">
				<span className="text-sm font-medium text-foreground">Description</span>
				<MarkdownEditor
					value={body}
					onChange={onBodyChange}
					placeholder="Describe the changes…"
					mentions={mentionConfig}
					onModEnter={handleExecute}
				/>
			</div>

			{error ? (
				<div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</div>
			) : null}

			<div className="flex items-center justify-end gap-3">
				<Button variant="ghost" asChild>
					<Link to="/$owner/$repo" params={{ owner, repo }}>
						Cancel
					</Link>
				</Button>

				<div className="inline-flex items-stretch overflow-hidden rounded-md shadow-xs">
					<button
						type="button"
						disabled={submitting}
						onClick={handleExecute}
						className={cn(
							"flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-[background-color,opacity] disabled:pointer-events-none disabled:opacity-50",
							draftMode
								? "bg-surface-2 text-foreground hover:bg-surface-2/80"
								: "bg-primary text-primary-foreground hover:bg-primary/90",
						)}
					>
						{submitting ? (
							<Spinner size={13} />
						) : draftMode ? (
							<GitPullRequestDraftIcon size={13} strokeWidth={2} />
						) : (
							<GitPullRequestIcon size={13} strokeWidth={2} />
						)}
						{label}
					</button>
					<button
						type="button"
						aria-label={
							draftMode
								? "Switch to create pull request"
								: "Switch to create draft"
						}
						disabled={submitting}
						onClick={() => setDraftMode((v) => !v)}
						className={cn(
							"flex h-8 w-7 items-center justify-center border-l transition-[background-color,opacity] disabled:pointer-events-none disabled:opacity-50",
							draftMode
								? "border-border bg-surface-2 text-foreground hover:bg-surface-2/80"
								: "border-black/40 bg-primary text-primary-foreground hover:bg-primary/90 dark:border-white/20",
						)}
					>
						<ChevronDownIcon size={13} strokeWidth={2} />
					</button>
				</div>
			</div>
		</div>
	);
}
