import { CheckIcon } from "@diffkit/icons";
import { MarkdownEditor } from "@diffkit/ui/components/markdown-editor";
import { toast } from "@diffkit/ui/components/sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { type SetStateAction, useReducer } from "react";
import { AppMarkdown } from "#/components/markdown/app-markdown";
import type { CommentTarget } from "#/lib/comment-cache";
import { formatRelativeTime } from "#/lib/format-relative-time";
import { useCommentActions } from "./use-comment-actions";

type EditState =
	| { status: "viewing" }
	| { status: "editing"; original: string; draft: string };

type EditEvent =
	| { type: "start"; body: string }
	| { type: "change"; draft: SetStateAction<string> }
	| { type: "close" }
	| { type: "reopen"; original: string; draft: string };

function editReducer(state: EditState, event: EditEvent): EditState {
	switch (event.type) {
		case "start":
			return { status: "editing", original: event.body, draft: event.body };
		case "change":
			if (state.status !== "editing") return state;
			return {
				...state,
				draft:
					typeof event.draft === "function"
						? event.draft(state.draft)
						: event.draft,
			};
		case "close":
			return { status: "viewing" };
		case "reopen":
			return {
				status: "editing",
				original: event.original,
				draft: event.draft,
			};
	}
}

/**
 * Inline edit state for one posted comment. Saving closes the editor at once
 * (the cache already shows the new body) and reopens it with the draft if
 * GitHub rejects the edit.
 */
export function useCommentEditor(target: CommentTarget) {
	const [state, dispatch] = useReducer(editReducer, { status: "viewing" });
	const actions = useCommentActions(target);

	const save = async () => {
		if (state.status !== "editing") return;
		const { original, draft } = state;
		dispatch({ type: "close" });
		const result = await actions.edit(draft);
		if (!result.ok) {
			dispatch({ type: "reopen", original, draft });
			toast.error(result.error);
		}
	};

	return {
		state,
		start: (body: string) => dispatch({ type: "start", body }),
		change: (draft: SetStateAction<string>) =>
			dispatch({ type: "change", draft }),
		cancel: () => dispatch({ type: "close" }),
		save,
		remove: actions.remove,
	};
}

export type CommentEditor = ReturnType<typeof useCommentEditor>;

const saveButtonClassName =
	"flex h-7 items-center gap-1.5 rounded-md bg-indigo px-3 text-xs font-medium text-indigo-foreground shadow-solid transition-colors hover:bg-indigo/90 disabled:opacity-50";

export function CommentBody({
	editor,
	body,
	owner,
	repo,
	className,
}: {
	editor: CommentEditor;
	body: string;
	owner?: string;
	repo?: string;
	className?: string;
}) {
	const { state } = editor;
	if (state.status === "viewing") {
		return (
			<AppMarkdown owner={owner} repo={repo} className={className}>
				{body}
			</AppMarkdown>
		);
	}

	const unchanged = state.draft === state.original;
	return (
		<div className="flex flex-col gap-2">
			<MarkdownEditor
				value={state.draft}
				onChange={editor.change}
				placeholder="Leave a comment..."
				compact
				onKeyDown={(event) => {
					if (event.key === "Escape") editor.cancel();
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
						event.preventDefault();
						if (!unchanged && state.draft.trim()) void editor.save();
					}
				}}
			/>
			<div className="flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={editor.cancel}
					className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={() => void editor.save()}
					disabled={unchanged || !state.draft.trim()}
					className={saveButtonClassName}
				>
					<CheckIcon size={13} strokeWidth={2.5} />
					Save
				</button>
			</div>
		</div>
	);
}

export function EditedMark({ editedAt }: { editedAt?: string | null }) {
	if (!editedAt) return null;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="text-[13px] font-[450] text-icon-faint">edited</span>
			</TooltipTrigger>
			<TooltipContent>Edited {formatRelativeTime(editedAt)}</TooltipContent>
		</Tooltip>
	);
}
