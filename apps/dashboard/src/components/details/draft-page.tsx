import { Button } from "@diffkit/ui/components/button";
import { DetailLayout, LineCounts } from "@diffkit/ui/components/detail-layout";
import {
	MarkdownEditor,
	type MentionConfig,
} from "@diffkit/ui/components/markdown-editor";
import { mobilePrimaryActionClassName } from "@diffkit/ui/components/mobile-action-bar";
import { Spinner } from "@diffkit/ui/components/spinner";
import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import { useKeyboardFocus } from "@diffkit/ui/hooks/use-keyboard-focus";
import {
	type Dispatch,
	type KeyboardEvent,
	type ReactElement,
	type ReactNode,
	type SetStateAction,
	useRef,
	useState,
} from "react";
import { Skeleton } from "skullet/react";
import { AppMarkdown } from "#/components/markdown/app-markdown";

export type DraftSubmission =
	| { status: "idle" }
	| { status: "submitting" }
	| { status: "failed"; message: string };

type DraftView = "write" | "preview" | "files";

const TITLE_CLASS_NAME =
	"text-[23px] leading-8 font-semibold tracking-[-0.01em] text-foreground";
const MARKDOWN_HINT = "in Markdown: **bold**, `code`, - [ ] tasks, @mentions";

function isSubmitChord(event: KeyboardEvent) {
	return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

/**
 * Writing an issue or pull request on the page it will become: the detail
 * layout, with the title and description editable where they will be read.
 */
export function DraftPage({
	owner,
	repo,
	heading,
	title,
	titlePlaceholder,
	onTitleChange,
	body,
	bodyPrompt,
	onBodyChange,
	mentions,
	titleDetail,
	panel,
	files,
	loading = false,
	submission,
	submitLabel,
	submitIcon,
	cancel,
	onSubmit,
}: {
	owner: string;
	repo: string;
	heading: string;
	title: string;
	titlePlaceholder: string;
	onTitleChange: (value: string) => void;
	body: string;
	bodyPrompt: string;
	onBodyChange: (value: string) => void;
	mentions: MentionConfig;
	titleDetail?: ReactNode;
	panel: ReactNode;
	files?: {
		count: number;
		additions: number;
		deletions: number;
		content: ReactNode;
	};
	loading?: boolean;
	submission: DraftSubmission;
	submitLabel: string;
	submitIcon: ReactNode;
	cancel: ReactElement;
	onSubmit: () => void;
}) {
	const [view, setView] = useState<DraftView>("write");
	const [titleKeyboardFocused, titleFocusHandlers] = useKeyboardFocus();
	const bodyRef = useRef<HTMLTextAreaElement>(null);

	const submitting = submission.status === "submitting";
	const canSubmit = !loading && !submitting && title.trim() !== "";
	const submit = () => {
		if (canSubmit) onSubmit();
	};
	const setBody: Dispatch<SetStateAction<string>> = (next) =>
		onBodyChange(typeof next === "function" ? next(body) : next);
	const submitOnChord = (event: KeyboardEvent) => {
		if (!isSubmitChord(event)) return;
		event.preventDefault();
		submit();
	};

	const createButton = (className?: string) => (
		<Button
			type="button"
			variant="accent"
			size="sm"
			className={className}
			disabled={!canSubmit}
			onClick={submit}
			iconLeft={submitting ? <Spinner size={13} /> : submitIcon}
		>
			{submitLabel}
		</Button>
	);
	const showingFiles = view === "files" && files !== undefined;

	return (
		<div className="flex h-full min-h-0 flex-col">
			<h1 className="sr-only">{heading}</h1>
			<DetailLayout
				content={showingFiles ? "diff" : "reading"}
				panel={<Skeleton loading={loading}>{panel}</Skeleton>}
				mobileActions={createButton(mobilePrimaryActionClassName)}
				toolbar={
					<ViewTabs
						label="Draft views"
						actions={
							<span className="flex items-center gap-1.5 max-md:hidden">
								<Button asChild variant="ghost" size="sm">
									{cancel}
								</Button>
								{createButton()}
							</span>
						}
					>
						<ViewTab active={view === "write"} onClick={() => setView("write")}>
							Write
						</ViewTab>
						<ViewTab
							active={view === "preview"}
							onClick={() => setView("preview")}
						>
							Preview
						</ViewTab>
						{files ? (
							<ViewTab
								active={view === "files"}
								onClick={() => setView("files")}
							>
								Files changed
								<ViewTabCount>{files.count}</ViewTabCount>
								<LineCounts
									additions={files.additions}
									deletions={files.deletions}
									className="ml-1.5 text-xs max-md:hidden"
								/>
							</ViewTab>
						) : null}
					</ViewTabs>
				}
			>
				{showingFiles ? (
					files.content
				) : (
					<Skeleton
						loading={loading}
						label={`Loading ${heading.toLowerCase()}`}
					>
						<div className="flex flex-col gap-8">
							<div className="flex flex-col gap-2">
								{view === "preview" ? (
									<h2 className={`${TITLE_CLASS_NAME} text-pretty`}>
										{title || titlePlaceholder}
									</h2>
								) : (
									<textarea
										{...titleFocusHandlers}
										aria-label="Title"
										rows={1}
										value={title}
										placeholder={titlePlaceholder}
										onChange={(event) => onTitleChange(event.target.value)}
										onKeyDown={(event) => {
											if (isSubmitChord(event)) {
												submitOnChord(event);
											} else if (event.key === "Enter") {
												event.preventDefault();
												bodyRef.current?.focus();
											}
										}}
										data-keyboard-focus={titleKeyboardFocused ? "" : undefined}
										className={`${TITLE_CLASS_NAME} w-full resize-none bg-transparent [field-sizing:content] outline-none placeholder:text-composer-placeholder data-keyboard-focus:rounded-sm data-keyboard-focus:outline-1 data-keyboard-focus:outline-offset-2 data-keyboard-focus:outline-ring`}
									/>
								)}
								{titleDetail}
							</div>
							{submission.status === "failed" ? (
								<div
									role="alert"
									className="rounded-lg bg-pill-blocked px-4 py-3 text-[13px] font-[450] text-pill-blocked-text"
								>
									{submission.message}
								</div>
							) : null}
							{view === "preview" ? (
								body.trim() ? (
									<AppMarkdown
										owner={owner}
										repo={repo}
										className="text-[15px] leading-6 font-[450] text-text-header"
									>
										{body}
									</AppMarkdown>
								) : (
									<p className="text-sm text-muted-foreground">
										Nothing to preview yet.
									</p>
								)
							) : (
								<div className="[&_textarea]:min-h-[45vh] [&_textarea]:px-0 [&_textarea]:pt-0">
									<MarkdownEditor
										bare
										compact
										value={body}
										onChange={setBody}
										onKeyDown={submitOnChord}
										textareaRef={bodyRef}
										placeholder={`${bodyPrompt} ${MARKDOWN_HINT}`}
										mentions={mentions}
									/>
								</div>
							)}
						</div>
					</Skeleton>
				)}
			</DetailLayout>
		</div>
	);
}
