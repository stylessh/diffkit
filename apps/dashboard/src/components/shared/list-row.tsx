import { RepoIcon } from "@diffkit/icons";
import { Chip } from "@diffkit/ui/components/chip";
import { cn } from "@diffkit/ui/lib/utils";
import type { GitHubActor, GitHubLabel } from "#/lib/github.types";

/**
 * A list row on Linear's grid (measured off its Reviews list at 1440px): on
 * desktop a 44px line that runs the list's full width, its hover fill inset
 * 8px with 8px corners; content starts 42px in and ends 26px before the edge,
 * 8px between columns. On mobile it folds into a two-line row.
 */
export const listRowClassName = cn(
	"group/row relative isolate flex items-start gap-3 px-3 py-2.5 text-left outline-none",
	"before:absolute before:inset-0 before:-z-10 before:rounded-lg before:transition-colors focus-visible:before:outline-1 focus-visible:before:-outline-offset-1 focus-visible:before:outline-focus",
	"md:-mx-2 md:h-11 md:w-[calc(100%+16px)] md:items-center md:gap-2 md:py-0 md:pr-[26px] md:pl-[42px] md:before:inset-x-2",
);

/** The hover fill, for rows without nested actions. */
export const listRowHoverClassName = "hover:before:bg-row-hover";

/** The state icon's 16px column. */
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

/** The number's 42px column: 13px/450 muted tabular figures. */
export function RowNumber({ number }: { number: number }) {
	return (
		<span className="hidden w-[42px] shrink-0 text-[13px] font-[450] whitespace-nowrap tabular-nums text-muted-foreground md:inline">
			#{number}
		</span>
	);
}

/** A label as Linear draws it in a row: a chip with the label's color as a dot. */
export function LabelChip({ label }: { label: GitHubLabel }) {
	return (
		<Chip className="max-w-36" title={label.name}>
			<span
				aria-hidden
				className="size-2 shrink-0 rounded-full"
				style={{ backgroundColor: `#${label.color}` }}
			/>
			<span className="truncate">{label.name}</span>
		</Chip>
	);
}

/** Up to `max` label chips, hidden below 1024px as Linear drops labels first. */
export function RowLabels({
	labels,
	max = 2,
}: {
	labels: GitHubLabel[];
	max?: number;
}) {
	if (labels.length === 0) return null;
	const shown = labels.slice(0, max);
	const rest = labels.length - shown.length;
	return (
		<span className="hidden min-w-0 shrink items-center gap-1 lg:flex">
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

/** The repository a row belongs to, as a chip, for lists that span repositories. */
export function RepoChip({ fullName }: { fullName: string }) {
	return (
		<Chip className="max-w-48 shrink" title={fullName}>
			<RepoIcon size={12} strokeWidth={2} />
			<span className="truncate">{fullName}</span>
		</Chip>
	);
}

/** The author's 18px avatar with a hairline ring. */
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

/** The row's time: 12px/450 muted, right-aligned in a 40px column. */
export function RowTime({ children }: { children: React.ReactNode }) {
	return (
		<span className="min-w-10 shrink-0 text-right text-xs font-[450] whitespace-nowrap tabular-nums text-muted-foreground">
			{children}
		</span>
	);
}
