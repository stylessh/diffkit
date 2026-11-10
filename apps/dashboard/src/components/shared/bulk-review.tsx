import { CheckIcon, CircleXIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { KeyboardShortcutKeys } from "@diffkit/ui/components/keyboard-shortcut-keys";
import { Spinner } from "@diffkit/ui/components/spinner";
import { cn } from "@diffkit/ui/lib/utils";
import {
	type BulkItemOutcome,
	type CountNoun,
	countOf,
	planBulkAction,
} from "#/lib/bulk-actions";
import type { BulkItemSummary, BulkReview } from "./bulk-action";

const QUEUED: BulkItemOutcome = { status: "queued" };

/** The rows a review is about: the live plan while confirming, the frozen run after. */
function reviewTargets<T>(review: BulkReview<T>, selected: readonly T[]) {
	const { run, action } = review;
	if (run.status === "confirming") {
		const plan = planBulkAction(selected, action.skipReason);
		return { targets: plan.targets, skipped: plan.skipped, failed: [] };
	}
	return {
		targets: run.targets,
		skipped: [],
		failed: run.targets.filter(
			(item) => run.outcomes.get(item)?.status === "failed",
		),
	};
}

export function BulkReviewSection<T>({
	titleId,
	review,
	selected,
	noun,
	describe,
	getKey,
}: {
	titleId: string;
	review: BulkReview<T>;
	selected: readonly T[];
	noun: CountNoun;
	describe: (item: T) => BulkItemSummary;
	getKey: (item: T) => string;
}) {
	const { run, action } = review;
	const { targets, skipped, failed } = reviewTargets(review, selected);
	const what = countOf(targets.length, noun);

	const title = {
		confirming: `${action.copy.confirm(what)}?`,
		running: action.copy.confirm(what),
		settled: action.copy.done(`${targets.length - failed.length} of ${what}`),
	}[run.status];
	const description =
		run.status === "settled"
			? `${countOf(failed.length, noun)} failed and ${failed.length === 1 ? "is" : "are"} still selected.`
			: targets.length > 1
				? "They run one at a time, in this order."
				: null;

	return (
		<>
			<header className="flex flex-col gap-1 px-4 pt-3.5 pb-2.5">
				<h2
					id={titleId}
					className="text-[13px] font-semibold tracking-tight text-text-strong"
				>
					{title}
				</h2>
				{description ? (
					<p className="text-xs text-muted-foreground">{description}</p>
				) : null}
			</header>
			{run.status === "confirming" && action.settings ? (
				<div className="px-4 pb-2.5">{action.settings}</div>
			) : null}
			<div className="max-h-[min(50vh,420px)] overflow-y-auto px-1 pb-1.5">
				<ul className="flex flex-col">
					{targets.map((item) => (
						<BulkItemLine
							key={getKey(item)}
							summary={describe(item)}
							outcome={
								run.status === "confirming"
									? QUEUED
									: (run.outcomes.get(item) ?? QUEUED)
							}
						/>
					))}
				</ul>
				{skipped.length > 0 ? (
					<>
						<p className="px-3 pt-2.5 pb-1 text-xs font-medium text-muted-foreground">
							Left out
						</p>
						<ul className="flex flex-col">
							{skipped.map(({ item, reason }) => (
								<BulkItemLine
									key={getKey(item)}
									summary={describe(item)}
									outcome={QUEUED}
									skipReason={reason}
								/>
							))}
						</ul>
					</>
				) : null}
			</div>
		</>
	);
}

export function BulkReviewControls<T>({
	review,
	selected,
	noun,
	onStart,
	onDismiss,
}: {
	review: BulkReview<T>;
	selected: readonly T[];
	noun: CountNoun;
	onStart: (targets: readonly T[]) => void;
	onDismiss: () => void;
}) {
	const { run, action } = review;
	const { targets, failed } = reviewTargets(review, selected);

	if (run.status === "settled") {
		return (
			<>
				<Button variant="outline" size="sm" onClick={onDismiss}>
					Done
				</Button>
				<Button autoFocus size="sm" onClick={() => onStart(failed)}>
					Retry {countOf(failed.length, noun)}
				</Button>
			</>
		);
	}

	const isRunning = run.status === "running";
	return (
		<>
			<Button
				variant="outline"
				size="sm"
				disabled={isRunning}
				onClick={onDismiss}
			>
				Cancel
				<KeyboardShortcutKeys keys={["Esc"]} />
			</Button>
			<Button
				autoFocus
				size="sm"
				disabled={isRunning}
				iconLeft={isRunning ? <Spinner size={13} /> : undefined}
				onClick={() => onStart(targets)}
			>
				{isRunning
					? action.copy.running
					: action.copy.confirm(countOf(targets.length, noun))}
			</Button>
		</>
	);
}

function BulkItemLine({
	summary,
	outcome,
	skipReason,
}: {
	summary: BulkItemSummary;
	outcome: BulkItemOutcome;
	skipReason?: string;
}) {
	return (
		<li
			className={cn(
				"flex min-h-9 flex-col justify-center px-3 py-1.5",
				skipReason && "opacity-60",
			)}
		>
			<div className="flex items-center gap-2">
				<span className="flex w-4 shrink-0 justify-center">
					{outcome.status === "queued" ? (
						summary.icon
					) : (
						<OutcomeMark outcome={outcome} />
					)}
				</span>
				<span className="shrink-0 text-[13px] font-[450] tabular-nums text-muted-foreground">
					#{summary.number}
				</span>
				<span
					title={summary.title}
					className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground"
				>
					{summary.title}
				</span>
				<span className="max-w-40 shrink-0 truncate text-xs text-muted-foreground">
					{summary.detail}
				</span>
				{skipReason ? (
					<span className="shrink-0 text-xs font-medium text-muted-foreground">
						{skipReason}
					</span>
				) : null}
			</div>
			{outcome.status === "failed" ? (
				<p className="pt-0.5 pl-6 text-xs text-pretty text-danger">
					{outcome.error}
				</p>
			) : null}
		</li>
	);
}

function OutcomeMark({
	outcome,
}: {
	outcome: Exclude<BulkItemOutcome, { status: "queued" }>;
}) {
	switch (outcome.status) {
		case "running":
			return (
				<>
					<Spinner size={13} className="text-muted-foreground" />
					<span className="sr-only">In progress</span>
				</>
			);
		case "done":
			return (
				<>
					<CheckIcon size={14} strokeWidth={2} className="text-success" />
					<span className="sr-only">Done</span>
				</>
			);
		case "failed":
			return (
				<>
					<CircleXIcon size={14} strokeWidth={2} className="text-danger" />
					<span className="sr-only">Failed</span>
				</>
			);
	}
}
