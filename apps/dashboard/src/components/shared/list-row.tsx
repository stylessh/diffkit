import { CommentIcon, RepoIcon } from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { cn } from "@diffkit/ui/lib/utils";
import type { GitHubActor, GitHubLabel } from "#/lib/github.types";

export const listRowClassName = cn(
	"group/row relative isolate flex items-start gap-3 px-3 py-2.5 text-left outline-none",
	"before:absolute before:inset-0 before:-z-10 before:rounded-lg focus-visible:before:outline-1 focus-visible:before:-outline-offset-1 focus-visible:before:outline-focus",
	"md:-mx-2 md:h-11 md:w-[calc(100%+16px)] md:items-center md:gap-2 md:py-0 md:pr-[26px] md:pl-[42px] md:before:inset-x-2",
);

export function rowAccessibleName(item: {
	title: string;
	number: number;
	comments: number;
	repository: { fullName: string };
	author: GitHubActor | null;
}) {
	const author = item.author ? ` · ${item.author.login}` : "";
	const comments =
		item.comments > 0
			? `, ${item.comments} ${item.comments === 1 ? "comment" : "comments"}`
			: "";
	return `${item.title} ${item.repository.fullName} #${item.number}${author}${comments}`;
}

export const listRowHoverClassName = "hover:before:bg-row-hover";

export function RowStateIcon({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<span
			className={cn(
				"mt-0.5 flex w-4 shrink-0 justify-center md:mt-0",
				className,
			)}
		>
			{children}
		</span>
	);
}

export function RowNumber({ number }: { number: number }) {
	return (
		<span className="hidden min-w-[42px] shrink-0 pr-2 text-[13px] font-[450] whitespace-nowrap tabular-nums text-muted-foreground md:inline">
			#{number}
		</span>
	);
}

export function LabelChip({ label }: { label: GitHubLabel }) {
	return (
		<Chip className="max-w-36" title={label.name}>
			<span
				aria-hidden
				className="flex size-2 shrink-0 items-center justify-center"
			>
				<span
					className="size-1.5 rounded-full"
					style={{ backgroundColor: `#${label.color}` }}
				/>
			</span>
			<span className="truncate">{label.name}</span>
		</Chip>
	);
}

export function RowLabels({
	labels,
	max = 3,
}: {
	labels: GitHubLabel[];
	max?: number;
}) {
	if (labels.length === 0) return null;
	const shown = labels.slice(0, max);
	const rest = labels.length - shown.length;
	return (
		<span className="hidden min-w-0 shrink items-center lg:flex [&>*+*]:-ml-3.5 [&>*:not(:last-child)]:pr-[17px]">
			{shown.map((label) => (
				<LabelChip key={label.name} label={label} />
			))}
			{rest > 0 ? (
				<Chip
					className="px-1.5 tabular-nums"
					title={labels
						.slice(max)
						.map((label) => label.name)
						.join(", ")}
				>
					+{rest}
				</Chip>
			) : null}
		</span>
	);
}

export function RepoChip({
	fullName,
	ownerAvatarUrl,
}: {
	fullName: string;
	ownerAvatarUrl?: string;
}) {
	return (
		<Chip className="max-w-48 shrink" title={fullName}>
			{ownerAvatarUrl ? (
				<img
					src={ownerAvatarUrl}
					alt=""
					className="size-3.5 shrink-0 rounded-[4px] ring-[0.5px] ring-chip-border"
				/>
			) : (
				<RepoIcon size={12} strokeWidth={2} />
			)}
			<span className="truncate">{fullName}</span>
		</Chip>
	);
}

export function RowAvatar({ actor }: { actor: GitHubActor | null }) {
	if (!actor) return <span className="size-[18px] shrink-0" />;
	return (
		<img
			src={actor.avatarUrl}
			alt={actor.login}
			title={actor.login}
			className="size-[18px] shrink-0 rounded-full ring-[0.5px] ring-chip-border"
		/>
	);
}

export function CommentsChip({ count }: { count: number }) {
	if (count === 0) return null;
	return (
		<Chip
			className="shrink-0 tabular-nums"
			title={`${count} ${count === 1 ? "comment" : "comments"}`}
		>
			<CommentIcon size={12} strokeWidth={2} />
			{count}
		</Chip>
	);
}

export function RowDiffStat({
	additions,
	deletions,
}: {
	additions?: number;
	deletions?: number;
}) {
	if (additions === undefined || deletions === undefined) return null;
	return (
		<span
			className="hidden shrink-0 items-center gap-1.5 text-xs font-[450] tabular-nums md:flex"
			title={`${additions} additions, ${deletions} deletions`}
		>
			<span className="text-added">+{additions}</span>
			<span className="text-removed">−{deletions}</span>
		</span>
	);
}

/**
 * The row's trailing time, a fixed-width column so avatars line up. Pass
 * `dateTime` to render a `<time>`; extra props (a tooltip trigger's) are
 * forwarded to the element.
 */
export function RowTime({
	className,
	dateTime,
	...props
}: React.ComponentProps<"time">) {
	const Comp = dateTime ? "time" : "span";
	return (
		<Comp
			dateTime={dateTime}
			className={cn(
				"min-w-10 shrink-0 text-right text-xs font-[450] whitespace-nowrap tabular-nums text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}
