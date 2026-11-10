import {
	ArchiveDownIcon,
	CheckIcon,
	CommentIcon,
	DisplayOptionsIcon,
	GitMergeIcon,
	GitPullRequestClosedIcon,
	GitPullRequestIcon,
	InboxIcon,
	IssueClosedCompletedIcon,
	IssuesIcon,
	MoreHorizontalIcon,
	NotificationIcon,
	PinIcon,
	RepoIcon,
} from "@diffkit/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@diffkit/ui/components/dropdown-menu";
import { GroupHeader } from "@diffkit/ui/components/group-header";
import {
	PageHeader,
	PageHeaderTitle,
	PageIconButton,
} from "@diffkit/ui/components/page-header";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@diffkit/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@diffkit/ui/components/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@diffkit/ui/components/tooltip";
import {
	ViewTab,
	ViewTabCount,
	ViewTabs,
} from "@diffkit/ui/components/view-tabs";
import { cn } from "@diffkit/ui/lib/utils";
import {
	type MouseEvent,
	memo,
	type ReactNode,
	useEffect,
	useRef,
} from "react";
import { Skeleton } from "skullet/react";
import { formatRelativeTime } from "#/lib/format-relative-time";
import type { NotificationItem } from "#/lib/github.types";
import {
	INBOX_GROUPINGS,
	type InboxFilter,
	type InboxGroup,
	type InboxGrouping,
	parseSubjectRef,
	reasonLabel,
} from "#/lib/inbox";
import { SAMPLE_INBOX_GROUP } from "./inbox-samples";

type IconComponent = React.ComponentType<{
	size?: number;
	strokeWidth?: number;
	className?: string;
}>;

export function subjectAppearance(item: NotificationItem): {
	icon: IconComponent;
	color: string;
} {
	const state = item.subjectState;
	switch (item.subject.type) {
		case "PullRequest":
			if (state === "merged")
				return { icon: GitMergeIcon, color: "text-state-merged" };
			if (state === "closed")
				return { icon: GitPullRequestClosedIcon, color: "text-state-closed" };
			return { icon: GitPullRequestIcon, color: "text-state-open" };
		case "Issue":
			return state === "closed"
				? { icon: IssueClosedCompletedIcon, color: "text-state-merged" }
				: { icon: IssuesIcon, color: "text-state-open" };
		case "Discussion":
			return { icon: CommentIcon, color: "text-muted-foreground" };
		default:
			return { icon: NotificationIcon, color: "text-muted-foreground" };
	}
}

const GROUPING_LABELS: Record<InboxGrouping, string> = {
	none: "No grouping",
	repository: "Repository",
	reason: "Reason",
};

function InboxDisplayOptions({
	grouping,
	onGroupingChange,
}: {
	grouping: InboxGrouping;
	onGroupingChange: (grouping: InboxGrouping) => void;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<PageIconButton
					raised
					type="button"
					aria-label="Display options"
					title="Display options"
				>
					<DisplayOptionsIcon size={14} />
				</PageIconButton>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[280px] p-4 pt-3 pb-3">
				<div className="flex h-8 items-center gap-2">
					<span
						id="inbox-grouping-label"
						className="flex-1 text-xs font-[450] text-muted-foreground"
					>
						Grouping
					</span>
					<Select
						value={grouping}
						onValueChange={(value) => onGroupingChange(value as InboxGrouping)}
					>
						<SelectTrigger
							size="sm"
							className="w-[136px]"
							aria-labelledby="inbox-grouping-label"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{INBOX_GROUPINGS.map((option) => (
								<SelectItem key={option} value={option}>
									{GROUPING_LABELS[option]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export type InboxListProps = {
	filter: InboxFilter;
	onFilterChange: (filter: InboxFilter) => void;
	counts: Record<InboxFilter, number | null>;
	grouping: InboxGrouping;
	onGroupingChange: (grouping: InboxGrouping) => void;
	groups: InboxGroup[];
	collapsed: ReadonlySet<string>;
	onToggleGroup: (key: string) => void;
	selectedId: string | null;
	savedIds: ReadonlySet<string>;
	isLoading?: boolean;
	/** Unused: background refreshes are silent. Kept until the landing preview stops passing it. */
	isRefreshing?: boolean;
	onSelect: (item: NotificationItem) => void;
	onMarkRead: (item: NotificationItem) => void;
	onMarkDone: (item: NotificationItem) => void;
	onToggleSaved: (item: NotificationItem) => void;
	onMarkAllRead: () => void;
	onMarkReadDone: () => void;
};

const FILTER_LABELS: Record<InboxFilter, string> = {
	unread: "Unread",
	all: "All",
	saved: "Saved",
};

export function InboxList(props: InboxListProps) {
	const { filter, groups, grouping } = props;
	const isEmpty = groups.every((group) => group.items.length === 0);

	return (
		<aside className="flex h-full w-full min-w-0 flex-col border-r-[0.5px] border-header-rule md:w-[380px] md:min-w-[380px]">
			<PageHeader
				actions={
					<>
						<InboxDisplayOptions
							grouping={grouping}
							onGroupingChange={props.onGroupingChange}
						/>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<PageIconButton type="button" aria-label="Inbox actions">
									<MoreHorizontalIcon size={15} strokeWidth={2} />
								</PageIconButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-52">
								<DropdownMenuItem onSelect={props.onMarkAllRead}>
									<CheckIcon size={15} strokeWidth={2} />
									Mark all as read
								</DropdownMenuItem>
								<DropdownMenuItem onSelect={props.onMarkReadDone}>
									<ArchiveDownIcon size={15} strokeWidth={2} />
									Mark read as done
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				}
			>
				<PageHeaderTitle>Inbox</PageHeaderTitle>
			</PageHeader>
			<ViewTabs
				label="Inbox views"
				className="border-b-[0.5px] border-header-rule"
			>
				{(["unread", "all", "saved"] as const).map((option) => (
					<ViewTab
						key={option}
						active={filter === option}
						onClick={() => props.onFilterChange(option)}
					>
						{FILTER_LABELS[option]}
						{props.counts[option] ? (
							<ViewTabCount>{props.counts[option]}</ViewTabCount>
						) : null}
					</ViewTab>
				))}
			</ViewTabs>
			<div className="flex-1 overflow-y-auto">
				<Skeleton loading={props.isLoading} label="Loading notifications">
					{props.isLoading ? (
						<div className="flex flex-col gap-1 px-2 py-2">
							<InboxGroupSection
								{...props}
								group={SAMPLE_INBOX_GROUP}
								grouping="none"
							/>
						</div>
					) : isEmpty ? (
						<InboxEmpty filter={filter} />
					) : (
						<div className="flex flex-col gap-1 px-2 py-2">
							{groups.map((group) => (
								<InboxGroupSection key={group.key} group={group} {...props} />
							))}
						</div>
					)}
				</Skeleton>
			</div>
		</aside>
	);
}

function InboxGroupSection({
	group,
	grouping,
	collapsed,
	onToggleGroup,
	...rowProps
}: InboxListProps & { group: InboxGroup }) {
	const open = !collapsed.has(group.key);
	return (
		<section
			aria-label={grouping === "none" ? "Notifications" : group.title}
			className="flex flex-col"
		>
			{grouping === "none" ? null : (
				<GroupHeader
					className="mb-0.5"
					icon={
						grouping === "repository" ? (
							<RepoIcon size={14} strokeWidth={2} />
						) : (
							<InboxIcon size={14} strokeWidth={2} />
						)
					}
					title={group.title}
					count={group.items.length}
					open={open}
					onToggle={() => onToggleGroup(group.key)}
				/>
			)}
			{open
				? group.items.map((item) => (
						<InboxRow
							key={item.id}
							item={item}
							showRepo={grouping !== "repository"}
							selected={item.id === rowProps.selectedId}
							saved={rowProps.savedIds.has(item.id)}
							onSelect={rowProps.onSelect}
							onMarkRead={rowProps.onMarkRead}
							onMarkDone={rowProps.onMarkDone}
							onToggleSaved={rowProps.onToggleSaved}
						/>
					))
				: null}
		</section>
	);
}

function RowAction({
	label,
	keys,
	onClick,
	children,
}: {
	label: string;
	keys?: string[];
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					data-action
					aria-label={label}
					onClick={(event: MouseEvent) => {
						event.stopPropagation();
						onClick();
					}}
					className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-ghost-hover hover:text-foreground"
				>
					{children}
				</button>
			</TooltipTrigger>
			<TooltipContent keys={keys}>{label}</TooltipContent>
		</Tooltip>
	);
}

const InboxRow = memo(function InboxRow({
	item,
	showRepo,
	selected,
	saved,
	onSelect,
	onMarkRead,
	onMarkDone,
	onToggleSaved,
}: {
	item: NotificationItem;
	showRepo: boolean;
	selected: boolean;
	saved: boolean;
	onSelect: (item: NotificationItem) => void;
	onMarkRead: (item: NotificationItem) => void;
	onMarkDone: (item: NotificationItem) => void;
	onToggleSaved: (item: NotificationItem) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const { icon: Icon, color } = subjectAppearance(item);
	const subject = parseSubjectRef(item);
	const location = [
		showRepo ? item.repository.fullName : null,
		subject ? `#${subject.number}` : null,
	]
		.filter(Boolean)
		.join(" ");

	useEffect(() => {
		if (selected) ref.current?.scrollIntoView({ block: "nearest" });
	}, [selected]);

	return (
		// biome-ignore lint/a11y/useSemanticElements: the row holds its own action buttons, which a <button> can't contain
		<div
			ref={ref}
			role="button"
			tabIndex={0}
			aria-current={selected ? "true" : undefined}
			onClick={() => onSelect(item)}
			onKeyDown={(event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onSelect(item);
				}
			}}
			className={cn(
				"group relative flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
				"hover:[&:not(:has([data-action]:hover))]:bg-row-hover",
				selected &&
					"bg-row-selected hover:[&:not(:has([data-action]:hover))]:bg-row-selected",
			)}
		>
			<span className="flex h-5 w-3.5 shrink-0 items-center">
				<Icon size={14} strokeWidth={2} className={color} />
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5 group-hover:pr-[88px]">
				<div className="flex items-center gap-2">
					<p
						className={cn(
							"min-w-0 flex-1 truncate text-[13px] leading-5",
							item.unread
								? "font-medium text-foreground"
								: "font-[450] text-text-header",
						)}
					>
						{item.subject.title}
					</p>
					<span className="shrink-0 text-xs tabular-nums text-muted-foreground group-hover:hidden">
						{formatRelativeTime(item.updatedAt, undefined, { compact: true })}
					</span>
				</div>
				<div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
					{item.unread ? (
						<>
							<span
								aria-hidden
								className="size-1.5 shrink-0 rounded-full bg-indigo"
							/>
							<span className="sr-only">Unread</span>
						</>
					) : null}
					{saved ? (
						<>
							<PinIcon
								size={11}
								strokeWidth={2}
								aria-hidden
								className="shrink-0"
							/>
							<span className="sr-only">Saved</span>
						</>
					) : null}
					<span className="truncate">
						{location ? `${location} · ` : ""}
						{reasonLabel(item.reason)}
					</span>
				</div>
			</div>
			<div className="absolute top-1.5 right-1.5 hidden items-center gap-0.5 group-hover:flex">
				{item.unread ? (
					<RowAction label="Mark as read" onClick={() => onMarkRead(item)}>
						<CheckIcon size={14} strokeWidth={2} />
					</RowAction>
				) : null}
				<RowAction
					label={saved ? "Unsave" : "Save"}
					keys={["S"]}
					onClick={() => onToggleSaved(item)}
				>
					<PinIcon size={14} strokeWidth={2} />
				</RowAction>
				<RowAction
					label="Mark as done"
					keys={["E"]}
					onClick={() => onMarkDone(item)}
				>
					<ArchiveDownIcon size={14} strokeWidth={2} />
				</RowAction>
			</div>
		</div>
	);
});

function InboxEmpty({ filter }: { filter: InboxFilter }) {
	const message =
		filter === "saved"
			? "Save a notification with S to keep it here."
			: filter === "unread"
				? "No unread notifications."
				: "No notifications.";
	return (
		<div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
			<InboxIcon size={22} strokeWidth={1.5} className="text-icon-faint" />
			<p className="text-[13px] font-medium text-text-header">
				{filter === "saved" ? "Nothing saved" : "All caught up"}
			</p>
			<p className="text-xs text-muted-foreground">{message}</p>
		</div>
	);
}
