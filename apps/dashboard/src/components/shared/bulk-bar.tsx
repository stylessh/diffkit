import { CircleCheckIcon } from "@diffkit/icons";
import { Button } from "@diffkit/ui/components/button";
import { KeyboardShortcutKeys } from "@diffkit/ui/components/keyboard-shortcut-keys";
import { liftedPopoverSurfaceClassName } from "@diffkit/ui/lib/lifted-overlay-surface";
import { cn } from "@diffkit/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import {
	type ReactNode,
	type RefObject,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { type CountNoun, planBulkAction } from "#/lib/bulk-actions";
import type { BarMode, BulkAction, BulkItemSummary } from "./bulk-action";
import { BulkReviewControls, BulkReviewSection } from "./bulk-review";

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

export function BulkBar<T>({
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
