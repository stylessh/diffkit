import { CheckIcon, CircleCheckIcon, CircleXIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { KeyboardShortcutKeys } from "@diffkit/ui/components/keyboard-shortcut-keys";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@diffkit/ui/components/select";
import { Spinner } from "@diffkit/ui/components/spinner";
import { liftedPopoverSurfaceClassName } from "@diffkit/ui/lib/lifted-overlay-surface";
import { cn } from "@diffkit/ui/lib/utils";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
	type BulkActionResult,
	type BulkItemOutcome,
	type BulkRun,
	type BulkRunEvent,
	bulkRunReducer,
	type CountNoun,
	countOf,
	IDLE_BULK_RUN,
	planBulkAction,
	runBulkAction,
} from "#/lib/bulk-actions";
import {
	createListSelectionStore,
	type ListSelectionStore,
} from "#/lib/list-selection";
import { useMediaQuery } from "#/lib/use-media-query";
import { ListSelectionScope } from "./list-selection";

/** Matches the `md:` breakpoint the row checkboxes and the bar appear at. */
const CHECKBOXES_VISIBLE = "(min-width: 768px)";

export type BulkAction<T> = {
	id: string;
	icon: ReactNode;
	copy: {
		/** The bar button, e.g. "Merge". */
		button: string;
		/** Review title and confirm button for "3 pull requests", e.g. "Merge 3 pull requests". */
		confirm: (what: string) => string;
		/** Confirm button while the run is in flight, e.g. "Merging…". */
		running: string;
		/** Result for "3 pull requests", e.g. "Merged 3 pull requests". */
		done: (what: string) => string;
	};
	/** Why the action leaves this item alone, or `null` when it applies. */
	skipReason: (item: T) => string | null;
	run: (item: T) => Promise<BulkActionResult>;
	onSettled?: (succeeded: T[]) => void;
	/** Extra controls shown above the list while confirming (a merge method). */
	settings?: ReactNode;
};

function useSelectedItems<T>(
	store: ListSelectionStore,
	items: readonly T[],
	getKey: (item: T) => string,
) {
	const keys = useSyncExternalStore(store.subscribe, store.get);

	useEffect(() => {
		store.retain(new Set(items.map(getKey)));
	}, [store, items, getKey]);

	return useMemo(() => {
		const seen = new Set<string>();
		return items.filter((item) => {
			const key = getKey(item);
			if (!keys.has(key) || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}, [items, keys, getKey]);
}

/**
 * Checkboxes on the rows inside it and a floating bar with the actions that
 * apply to the selection. Picking an action grows the bar into a review of the
 * rows it will run on, which then reports the run; a clean run is announced in
 * the bar itself.
 */
export function BulkSelection<T>({
	items,
	getKey,
	noun,
	actions,
	describe,
	children,
}: {
	/** Every row currently listed; a selected row that leaves the list is deselected. */
	items: readonly T[];
	getKey: (item: T) => string;
	noun: CountNoun;
	actions: BulkAction<T>[];
	describe: (item: T) => BulkItemSummary;
	children: ReactNode;
}) {
	const [store] = useState(createListSelectionStore);
	const hasCheckboxes = useMediaQuery(CHECKBOXES_VISIBLE);
	const selected = useSelectedItems(store, items, getKey);
	const [run, dispatch] = useReducer<BulkRun<T>, [BulkRunEvent<T>]>(
		bulkRunReducer,
		IDLE_BULK_RUN,
	);

	const action =
		run.status === "idle"
			? undefined
			: actions.find((candidate) => candidate.id === run.actionId);
	const mode = barMode(run, action, noun);

	const nothingLeftToConfirm =
		mode.kind === "review" &&
		mode.review.run.status === "confirming" &&
		planBulkAction(selected, mode.review.action.skipReason).targets.length ===
			0;
	useEffect(() => {
		if (nothingLeftToConfirm) dispatch({ type: "dismissed" });
	}, [nothingLeftToConfirm]);

	const isAnnouncing = run.status === "succeeded";
	useEffect(() => {
		if (!isAnnouncing) return;
		const dismiss = () => dispatch({ type: "dismissed" });
		const timer = setTimeout(dismiss, FEEDBACK_MS);
		const stopListening = store.subscribe(dismiss);
		return () => {
			clearTimeout(timer);
			stopListening();
		};
	}, [isAnnouncing, store]);

	const start = async (targets: readonly T[]) => {
		if (!action) return;
		dispatch({ type: "started", targets });
		const { succeeded } = await runBulkAction({
			targets,
			run: action.run,
			onOutcome: (item, outcome) =>
				dispatch({ type: "outcome", item, outcome }),
		});
		store.remove(succeeded.map(getKey));
		action.onSettled?.(succeeded);
		dispatch({ type: "finished" });
	};

	const isReporting = run.status === "running" || run.status === "settled";

	return (
		<>
			<ListSelectionScope
				store={store}
				shortcutsEnabled={hasCheckboxes && !isReporting}
				onEscape={() => {
					if (run.status === "idle") store.clear();
					else dispatch({ type: "dismissed" });
				}}
			>
				{children}
			</ListSelectionScope>
			<MotionConfig reducedMotion="user">
				<AnimatePresence>
					{selected.length > 0 || mode.kind !== "actions" ? (
						<BulkBar
							key="bar"
							mode={mode}
							selected={selected}
							noun={noun}
							actions={actions}
							describe={describe}
							getKey={getKey}
							onAction={(actionId) => dispatch({ type: "opened", actionId })}
							onStart={(targets) => void start(targets)}
							onDismiss={() => dispatch({ type: "dismissed" })}
							onClear={store.clear}
						/>
					) : null}
				</AnimatePresence>
			</MotionConfig>
		</>
	);
}

/** How long a finished run stays announced in the bar. */
const FEEDBACK_MS = 2500;

type BulkReview<T> = {
	run: Extract<BulkRun<T>, { status: "confirming" | "running" | "settled" }>;
	action: BulkAction<T>;
};

type BarMode<T> =
	| { kind: "actions" }
	| { kind: "review"; review: BulkReview<T> }
	| { kind: "feedback"; message: string };

function barMode<T>(
	run: BulkRun<T>,
	action: BulkAction<T> | undefined,
	noun: CountNoun,
): BarMode<T> {
	if (!action || run.status === "idle") return { kind: "actions" };
	if (run.status === "succeeded") {
		return {
			kind: "feedback",
			message: action.copy.done(countOf(run.count, noun)),
		};
	}
	return { kind: "review", review: { run, action } };
}

const PANEL_WIDTH = "min(480px, calc(100vw - 2rem))";

const SIZE_TRANSITION =
	"transition-[width,height] duration-250 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

/** Content that comes and goes inside the bar blurs in and out of focus. */
const SOFT_SWAP = {
	initial: { opacity: 0, filter: "blur(4px)" },
	animate: { opacity: 1, filter: "blur(0px)" },
	exit: { opacity: 0, filter: "blur(4px)" },
	transition: { duration: 0.2, ease: "easeOut" },
} as const;

/**
 * Keeps the surface exactly as large as what it shows, so its CSS transition
 * animates every change: opening the review, a row leaving, an error wrapping.
 * Content on its way out is taken out of the flow, so the surface is already
 * resizing while that content fades.
 */
function useSurfaceFit(isOpen: boolean) {
	const surfaceRef = useRef<HTMLDivElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const startRef = useRef<HTMLDivElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const [section, sectionRef] = useState<HTMLElement | null>(null);

	useLayoutEffect(() => {
		const surface = surfaceRef.current;
		const row = rowRef.current;
		const start = startRef.current;
		const end = endRef.current;
		if (!surface || !row || !start || !end) return;

		const resize = () => {
			const review = isOpen && section ? section.offsetHeight : 0;
			surface.style.height = `${row.offsetHeight + review}px`;
			if (isOpen) {
				surface.style.width = PANEL_WIDTH;
				return;
			}
			const style = getComputedStyle(row);
			const chrome =
				Number.parseFloat(style.paddingLeft) +
				Number.parseFloat(style.paddingRight) +
				(end.offsetWidth > 0 ? Number.parseFloat(style.columnGap) : 0);
			surface.style.width = `${start.offsetWidth + end.offsetWidth + chrome}px`;
		};
		resize();
		const observer = new ResizeObserver(resize);
		for (const element of [start, end, section]) {
			if (element) observer.observe(element);
		}
		return () => observer.disconnect();
	}, [isOpen, section]);

	return { surfaceRef, rowRef, startRef, endRef, sectionRef };
}

function BulkBar<T>({
	mode,
	selected,
	noun,
	actions,
	describe,
	getKey,
	onAction,
	onStart,
	onDismiss,
	onClear,
}: {
	mode: BarMode<T>;
	selected: readonly T[];
	noun: CountNoun;
	actions: BulkAction<T>[];
	describe: (item: T) => BulkItemSummary;
	getKey: (item: T) => string;
	onAction: (actionId: string) => void;
	onStart: (targets: readonly T[]) => void;
	onDismiss: () => void;
	onClear: () => void;
}) {
	const titleId = useId();
	const review = mode.kind === "review" ? mode.review : null;
	const { surfaceRef, rowRef, startRef, endRef, sectionRef } = useSurfaceFit(
		review !== null,
	);

	return createPortal(
		<div className="pointer-events-none fixed inset-x-0 bottom-14 z-40 hidden justify-center px-4 md:flex">
			<motion.div
				ref={surfaceRef}
				{...(review
					? { role: "dialog", "aria-labelledby": titleId }
					: {
							role: "toolbar",
							"aria-label": `Actions for the selected ${noun.other}`,
						})}
				initial={{ ...SOFT_SWAP.initial, y: 8 }}
				animate={{ ...SOFT_SWAP.animate, y: 0 }}
				exit={{ ...SOFT_SWAP.exit, y: 8 }}
				transition={SOFT_SWAP.transition}
				className={cn(
					liftedPopoverSurfaceClassName,
					"pointer-events-auto relative overflow-hidden rounded-xl",
					SIZE_TRANSITION,
				)}
			>
				<AnimatePresence>
					{review ? (
						<motion.section
							key="review"
							ref={sectionRef}
							{...SOFT_SWAP}
							style={{ width: PANEL_WIDTH }}
							className="absolute bottom-11 left-1/2 -translate-x-1/2 border-b-[0.5px] border-header-rule"
						>
							<BulkReviewSection
								titleId={titleId}
								review={review}
								selected={selected}
								noun={noun}
								describe={describe}
								getKey={getKey}
							/>
						</motion.section>
					) : null}
				</AnimatePresence>
				<div
					ref={rowRef}
					className="absolute inset-x-0 bottom-0 flex h-11 items-center justify-between gap-1.5 pr-1.5 pl-3.5"
				>
					<SwapSlot slotRef={startRef} anchor="left">
						{mode.kind === "feedback" ? (
							<motion.span
								key="feedback"
								{...SOFT_SWAP}
								role="status"
								className="flex items-center gap-2 pr-2 text-[13px] font-medium whitespace-nowrap text-text-strong"
							>
								<CircleCheckIcon
									size={15}
									strokeWidth={2}
									className="text-success"
								/>
								{mode.message}
							</motion.span>
						) : (
							<motion.span
								key="count"
								{...SOFT_SWAP}
								className="text-[13px] font-medium whitespace-nowrap tabular-nums text-text-strong"
							>
								{selected.length} selected
							</motion.span>
						)}
					</SwapSlot>
					<SwapSlot slotRef={endRef} anchor="right">
						{review ? (
							<motion.span
								key={review.run.status === "settled" ? "settled" : "confirm"}
								{...SOFT_SWAP}
								className="flex items-center gap-1.5"
							>
								<BulkReviewControls
									review={review}
									selected={selected}
									noun={noun}
									onStart={onStart}
									onDismiss={onDismiss}
								/>
							</motion.span>
						) : mode.kind === "actions" ? (
							<motion.span
								key="actions"
								{...SOFT_SWAP}
								className="flex items-center gap-1.5"
							>
								<BulkActionButtons
									selected={selected}
									actions={actions}
									onAction={onAction}
									onClear={onClear}
								/>
							</motion.span>
						) : null}
					</SwapSlot>
				</div>
			</motion.div>
		</div>,
		document.body,
	);
}

/**
 * One end of the toolbar row. What it held fades out pinned to its edge of the
 * bar while the replacement fades in, so the two never push each other around.
 */
function SwapSlot({
	slotRef,
	anchor,
	children,
}: {
	slotRef: RefObject<HTMLDivElement | null>;
	anchor: "left" | "right";
	children: ReactNode;
}) {
	return (
		<div ref={slotRef} className="relative flex shrink-0 items-center">
			<AnimatePresence mode="popLayout" initial={false} anchorX={anchor}>
				{children}
			</AnimatePresence>
		</div>
	);
}

function BulkActionButtons<T>({
	selected,
	actions,
	onAction,
	onClear,
}: {
	selected: readonly T[];
	actions: BulkAction<T>[];
	onAction: (actionId: string) => void;
	onClear: () => void;
}) {
	const available = actions
		.map((action) => ({
			action,
			count: planBulkAction(selected, action.skipReason).targets.length,
		}))
		.filter(({ count }) => count > 0);

	return (
		<>
			<span aria-hidden className="mx-1.5 h-4 w-px bg-header-rule" />
			{available.map(({ action, count }) => (
				<Button
					key={action.id}
					variant="outline"
					size="sm"
					iconLeft={action.icon}
					onClick={() => onAction(action.id)}
				>
					{action.copy.button}
					{count < selected.length ? (
						<span className="tabular-nums text-muted-foreground">{count}</span>
					) : null}
				</Button>
			))}
			<Button variant="ghost" size="sm" onClick={onClear}>
				Clear
				<KeyboardShortcutKeys keys={["Esc"]} />
			</Button>
		</>
	);
}

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

function BulkReviewSection<T>({
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

const QUEUED: BulkItemOutcome = { status: "queued" };

function BulkReviewControls<T>({
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

/** What a row of the review shows about an item. */
export type BulkItemSummary = {
	icon: ReactNode;
	number: number;
	title: string;
	/** Where the item lives, e.g. `owner/repo`. */
	detail: string;
};

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

/** A labelled choice for an action's `settings`, e.g. the merge method. */
export function BulkChoiceSetting<V extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: readonly { value: V; label: string }[];
	value: V;
	onChange: (value: V) => void;
}) {
	const labelId = useId();
	return (
		<div className="flex items-center gap-3">
			<span
				id={labelId}
				className="flex-1 text-[13px] font-[450] text-muted-foreground"
			>
				{label}
			</span>
			<Select
				value={value}
				onValueChange={(next) => {
					const option = options.find((option) => option.value === next);
					if (option) onChange(option.value);
				}}
			>
				<SelectTrigger className="w-[200px]" aria-labelledby={labelId}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent align="end">
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
