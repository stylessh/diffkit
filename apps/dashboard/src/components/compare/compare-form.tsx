import {
	ChevronDownIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
} from "@diffkit/icons";
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
					className="text-[13px] font-[450] text-muted-foreground"
				>
					Title <span className="text-destructive">*</span>
				</label>
				<input
					id="pr-title"
					ref={titleRef}
					value={title}
					onChange={(e) => onTitleChange(e.target.value)}
					placeholder="Pull request title"
					// biome-ignore lint/a11y/noAutofocus: intentional — this is a dedicated PR-creation page
					autoFocus
					className="flex h-9 w-full rounded-lg bg-surface-0 px-3 text-[13px] font-[450] text-foreground shadow-field outline-none placeholder:text-muted-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring"
				/>
			</div>

			<div className="compact-md-editor flex flex-col gap-2 [&_[class*='min-h-\[640px\]']]:!min-h-[20rem]">
				<span className="text-[13px] font-[450] text-muted-foreground">
					Description
				</span>
				<MarkdownEditor
					value={body}
					onChange={onBodyChange}
					placeholder="Describe the changes…"
					mentions={mentionConfig}
				/>
			</div>

			{error ? (
				<div
					role="alert"
					className="rounded-lg bg-pill-blocked px-4 py-3 text-[13px] font-[450] text-pill-blocked-text"
				>
					{error}
				</div>
			) : null}

			<div className="flex items-center justify-end gap-1.5">
				<Link
					to="/$owner/$repo"
					params={{ owner, repo }}
					className="flex h-7 items-center rounded-full px-2.5 text-xs font-medium text-text-header transition-colors hover:bg-ghost-hover"
				>
					Cancel
				</Link>

				<div
					className={cn(
						"inline-flex h-7 items-stretch overflow-hidden rounded-full",
						draftMode
							? "bg-button shadow-button"
							: "bg-indigo text-indigo-foreground shadow-[0_1px_1px_0_lch(0_0_0/0.12),0_3px_6px_-2px_lch(0_0_0/0.12)]",
					)}
				>
					<button
						type="button"
						disabled={submitting}
						onClick={handleExecute}
						className={cn(
							"flex items-center gap-1.5 pr-2.5 pl-3 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-45",
							draftMode
								? "text-foreground hover:bg-button-hover"
								: "hover:bg-white/10",
						)}
					>
						{submitting ? (
							<Spinner size={13} />
						) : draftMode ? (
							<GitPullRequestDraftIcon size={14} strokeWidth={2} />
						) : (
							<GitPullRequestIcon size={14} strokeWidth={2} />
						)}
						{label}
					</button>
					<span
						aria-hidden
						className={cn(
							"my-auto h-3.5 w-px",
							draftMode ? "bg-chip-border" : "bg-white/25",
						)}
					/>
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
							"flex w-7 items-center justify-center pr-0.5 transition-colors disabled:pointer-events-none disabled:opacity-45",
							draftMode
								? "text-muted-foreground hover:bg-button-hover hover:text-foreground"
								: "hover:bg-white/10",
						)}
					>
						<ChevronDownIcon size={12} strokeWidth={2} />
					</button>
				</div>
			</div>
		</div>
	);
}
