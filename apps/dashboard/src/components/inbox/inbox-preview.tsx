import {
	ArchiveDownIcon,
	ExternalLinkIcon,
	InboxIcon,
	PinIcon,
	ViewOffIcon,
} from "@diffkit/icons";
import {
	PageHeader,
	PageHeaderTitle,
	PageIconButton,
} from "@diffkit/ui/components/page-header";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import { cn } from "@diffkit/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { IssueDetailContent } from "#/components/issues/detail/issue-detail-page";
import { PullDetailContent } from "#/components/pulls/detail/pull-detail-page";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { NotificationItem } from "#/lib/github.types";
import { parseSubjectRef, reasonLabel, subjectHref } from "#/lib/inbox";
import { subjectAppearance } from "./inbox-list";

function PreviewAction({
	label,
	keys,
	onClick,
	children,
}: {
	label: string;
	keys: string[];
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<PageIconButton type="button" aria-label={label} onClick={onClick}>
					{children}
				</PageIconButton>
			</TooltipTrigger>
			<TooltipContent keys={keys}>{label}</TooltipContent>
		</Tooltip>
	);
}

export function InboxPreview({
	item,
	userId,
	saved,
	onToggleSaved,
	onUnsubscribe,
	onMarkDone,
}: {
	item: NotificationItem | null;
	userId: string;
	saved: boolean;
	onToggleSaved: (item: NotificationItem) => void;
	onUnsubscribe: (item: NotificationItem) => void;
	onMarkDone: (item: NotificationItem) => void;
}) {
	if (!item) {
		return (
			<div className="hidden flex-1 flex-col items-center justify-center gap-2 text-center md:flex">
				<InboxIcon size={24} strokeWidth={1.5} className="text-icon-faint" />
				<p className="text-[13px] font-medium text-text-header">
					No notification selected
				</p>
				<p className="text-xs text-muted-foreground">
					Use J and K to move, E to mark done.
				</p>
			</div>
		);
	}

	const subject = parseSubjectRef(item);
	return (
		<div className="hidden min-w-0 flex-1 flex-col md:flex">
			<PageHeader
				actions={
					<>
						<PreviewAction
							label={saved ? "Unsave" : "Save"}
							keys={["S"]}
							onClick={() => onToggleSaved(item)}
						>
							<PinIcon size={15} strokeWidth={2} />
						</PreviewAction>
						<PreviewAction
							label="Unsubscribe"
							keys={["⇧", "M"]}
							onClick={() => onUnsubscribe(item)}
						>
							<ViewOffIcon size={15} strokeWidth={2} />
						</PreviewAction>
						<PreviewAction
							label="Mark as done"
							keys={["E"]}
							onClick={() => onMarkDone(item)}
						>
							<ArchiveDownIcon size={15} strokeWidth={2} />
						</PreviewAction>
						{subject ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<PageIconButton asChild aria-label="Open">
										<Link to={subjectHref(subject)}>
											<ExternalLinkIcon size={15} strokeWidth={2} />
										</Link>
									</PageIconButton>
								</TooltipTrigger>
								<TooltipContent keys={["↵"]}>Open</TooltipContent>
							</Tooltip>
						) : null}
					</>
				}
			>
				<PageHeaderTitle className="text-muted-foreground">
					<span className="truncate">{item.repository.fullName}</span>
					<span className="text-icon-faint">·</span>
					<span className="truncate">{reasonLabel(item.reason)}</span>
				</PageHeaderTitle>
			</PageHeader>
			<div className="min-h-0 flex-1 overflow-hidden">
				{subject?.type === "PullRequest" ? (
					<PullDetailContent
						key={item.id}
						owner={subject.owner}
						repo={subject.repo}
						pullNumber={subject.number}
						userId={userId}
					/>
				) : subject?.type === "Issue" ? (
					<IssueDetailContent
						key={item.id}
						owner={subject.owner}
						repo={subject.repo}
						issueNumber={subject.number}
						userId={userId}
					/>
				) : (
					<SubjectSummary item={item} />
				)}
			</div>
		</div>
	);
}

function SubjectSummary({ item }: { item: NotificationItem }) {
	const { icon: Icon, color } = subjectAppearance(item);
	return (
		<div className="flex flex-col gap-3 px-8 py-8">
			<div className="flex items-start gap-2.5">
				<Icon
					size={18}
					strokeWidth={2}
					className={cn("mt-1 shrink-0", color)}
				/>
				<h2 className="text-xl font-semibold tracking-tight text-foreground">
					{item.subject.title}
				</h2>
			</div>
			<p className="text-[13px] text-muted-foreground">
				{item.subject.type.replace(/([a-z])([A-Z])/gu, "$1 $2")} in{" "}
				{item.repository.fullName} · {formatRelativeTime(item.updatedAt)}
			</p>
		</div>
	);
}
