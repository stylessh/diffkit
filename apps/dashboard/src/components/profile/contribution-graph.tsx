import { easedFadeMask } from "@diffkit/ui/lib/eased-mask";
import { cn } from "@diffkit/ui/lib/utils";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import {
	type ContributionGridLayout,
	dayIndexForSlot,
	fitContributionGrid,
} from "#/lib/contribution-grid";
import type { GitHubContributionCalendar } from "#/lib/github.types";

type ContributionGraphProps = {
	calendar: GitHubContributionCalendar;
	className?: string;
};

type Day = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };

/** Resolved fill per level; index 0 is also the empty slot before the first day. */
type Palette = readonly [string, string, string, string, string];

/** The entrance plays once, the first time there is a grid to draw. */
type Intro =
	| { phase: "pending" }
	| { phase: "running"; startedAt: number }
	| { phase: "done" };

const INTRO_SPREAD_MS = 700;
const INTRO_CELL_MS = 450;

/** Fades eat into every edge, deepest at the bottom so the avatar and name sit on clean ground. */
const BANNER_MASK = `${easedFadeMask("to right", "clamp(3rem, 14%, 12rem)", "clamp(3rem, 14%, 12rem)")}, ${easedFadeMask("to bottom", "2.5rem", "55%")}`;

function ordinalSuffix(n: number) {
	const v = n % 100;
	if (v >= 11 && v <= 13) return "th";
	const r = n % 10;
	if (r === 1) return "st";
	if (r === 2) return "nd";
	if (r === 3) return "rd";
	return "th";
}

function parseDateParts(dateStr: string) {
	const date = new Date(dateStr);
	return {
		month: date.toLocaleDateString("en-US", {
			month: "short",
			timeZone: "UTC",
		}),
		day: date.getUTCDate(),
		year: date.getUTCFullYear(),
	};
}

/**
 * The level colours as the browser resolves them right now (themes mix them
 * from tokens), turned into concrete colours a canvas can fill with.
 */
function readPalette(host: HTMLElement): Palette {
	const probe = document.createElement("span");
	probe.style.display = "none";
	host.appendChild(probe);
	const level = (n: number) => {
		probe.style.color = `var(--contrib-level-${n})`;
		return getComputedStyle(probe).color;
	};
	const palette: Palette = [level(0), level(1), level(2), level(3), level(4)];
	probe.remove();
	return palette;
}

function easeOutBack(t: number) {
	const c1 = 1.4;
	const c3 = c1 + 1;
	return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function drawGrid(
	context: CanvasRenderingContext2D,
	layout: ContributionGridLayout,
	days: readonly Day[],
	palette: Palette,
	elapsed: number | null,
) {
	const { cell, gap, cols, rows, offsetX, offsetY } = layout;
	const step = cell + gap;
	const radius = Math.min(2.5, cell * 0.22);
	const centerCol = (cols - 1) / 2;
	const centerRow = (rows - 1) / 2;
	const farthest = Math.hypot(centerCol, centerRow) || 1;

	if (elapsed === null) {
		// At rest: one path per level, five fills for the whole grid.
		const paths = palette.map(() => new Path2D());
		for (let col = 0; col < cols; col++) {
			for (let row = 0; row < rows; row++) {
				const index = dayIndexForSlot(layout, col, row);
				const level = index === null ? 0 : (days[index]?.level ?? 0);
				paths[level].roundRect(
					offsetX + col * step,
					offsetY + row * step,
					cell,
					cell,
					radius,
				);
			}
		}
		paths.forEach((path, level) => {
			context.fillStyle = palette[level];
			context.fill(path);
		});
		return;
	}

	for (let col = 0; col < cols; col++) {
		for (let row = 0; row < rows; row++) {
			const delay =
				(Math.hypot(col - centerCol, row - centerRow) / farthest) *
				INTRO_SPREAD_MS;
			const t = Math.min(1, Math.max(0, (elapsed - delay) / INTRO_CELL_MS));
			if (t === 0) continue;
			const index = dayIndexForSlot(layout, col, row);
			const level = index === null ? 0 : (days[index]?.level ?? 0);
			const size = cell * (0.65 + 0.35 * easeOutBack(t));
			const inset = (cell - size) / 2;
			context.globalAlpha = t;
			context.fillStyle = palette[level];
			context.beginPath();
			context.roundRect(
				offsetX + col * step + inset,
				offsetY + row * step + inset,
				size,
				size,
				radius,
			);
			context.fill();
		}
	}
	context.globalAlpha = 1;
}

/**
 * A year of contributions filling the whole banner: the cell size, rows and
 * columns come from the banner's measured size, so every day shows at any
 * width. Drawn on one canvas, and redrawn only when the size or theme changes.
 */
export function ContributionGraph({
	calendar,
	className,
}: ContributionGraphProps) {
	const frameRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const introRef = useRef<Intro>({ phase: "pending" });

	const [size, setSize] = useState<{ width: number; height: number } | null>(
		null,
	);
	const [palette, setPalette] = useState<Palette | null>(null);
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	const mouseX = useMotionValue(0);
	const mouseY = useMotionValue(0);
	const tooltipX = useMotionValue(10);

	const days = useMemo<Day[]>(
		() =>
			calendar.weeks.flatMap((week) =>
				week.days.map((day) => ({
					date: day.date,
					count: day.count,
					level: day.level,
				})),
			),
		[calendar.weeks],
	);

	const layout = useMemo(
		() =>
			size ? fitContributionGrid(size.width, size.height, days.length) : null,
		[size, days.length],
	);

	useLayoutEffect(() => {
		const frame = frameRef.current;
		if (!frame) return;
		const measure = () => {
			const { width, height } = frame.getBoundingClientRect();
			setSize((previous) =>
				previous?.width === width && previous.height === height
					? previous
					: { width, height },
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(frame);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const frame = frameRef.current;
		if (!frame) return;
		const refresh = () => setPalette(readPalette(frame));
		refresh();
		const observer = new MutationObserver(refresh);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "data-light-theme", "data-dark-theme"],
		});
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !layout || !size || !palette) return;
		const context = canvas.getContext("2d");
		if (!context) return;

		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(size.width * ratio);
		canvas.height = Math.round(size.height * ratio);

		const paint = (elapsed: number | null) => {
			context.setTransform(ratio, 0, 0, ratio, 0, 0);
			context.clearRect(0, 0, size.width, size.height);
			drawGrid(context, layout, days, palette, elapsed);
		};

		if (introRef.current.phase === "pending") {
			const reduceMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			introRef.current = reduceMotion
				? { phase: "done" }
				: { phase: "running", startedAt: performance.now() };
		}

		const intro = introRef.current;
		if (intro.phase !== "running") {
			paint(null);
			return;
		}

		let frameId = 0;
		const total = INTRO_SPREAD_MS + INTRO_CELL_MS;
		const tick = (now: number) => {
			const elapsed = now - intro.startedAt;
			if (elapsed >= total) {
				introRef.current = { phase: "done" };
				paint(null);
				return;
			}
			paint(elapsed);
			frameId = requestAnimationFrame(tick);
		};
		frameId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frameId);
	}, [layout, size, palette, days]);

	useLayoutEffect(() => {
		if (activeIndex === null || !tooltipRef.current) return;
		const width = tooltipRef.current.offsetWidth;
		const overflows = mouseX.get() + 10 + width > window.innerWidth - 8;
		animate(tooltipX, overflows ? -10 - width : 10, {
			duration: 0.15,
			ease: "easeOut",
		});
	}, [activeIndex, mouseX, tooltipX]);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			const frame = frameRef.current;
			if (!frame || !layout) return;
			const bounds = frame.getBoundingClientRect();
			const step = layout.cell + layout.gap;
			const col = Math.floor(
				(event.clientX - bounds.left - layout.offsetX) / step,
			);
			const row = Math.floor(
				(event.clientY - bounds.top - layout.offsetY) / step,
			);
			mouseX.set(event.clientX);
			mouseY.set(event.clientY + 8);
			const index = dayIndexForSlot(layout, col, row);
			setActiveIndex((previous) => (previous === index ? previous : index));
		},
		[layout, mouseX, mouseY],
	);

	const handlePointerLeave = useCallback(() => setActiveIndex(null), []);

	const activeDay = activeIndex === null ? null : (days[activeIndex] ?? null);
	const dateParts = useMemo(
		() => (activeDay ? parseDateParts(activeDay.date) : null),
		[activeDay],
	);
	const ringSlot =
		activeIndex !== null && layout
			? activeIndex - layout.skipped + layout.leading
			: null;

	return (
		<div
			ref={frameRef}
			className={cn("relative overflow-hidden", className)}
			style={{
				maskImage: BANNER_MASK,
				WebkitMaskImage: BANNER_MASK,
				maskComposite: "intersect",
				WebkitMaskComposite: "source-in",
			}}
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
		>
			<canvas
				ref={canvasRef}
				role="img"
				aria-label={`${calendar.totalContributions.toLocaleString()} contributions in the last year`}
				className="absolute inset-0 size-full opacity-70 dark:opacity-55"
			/>
			{layout && ringSlot !== null ? (
				<span
					aria-hidden
					className="pointer-events-none absolute top-0 left-0 rounded-[3px] border-[1.5px] border-primary transition-transform duration-150 ease-out"
					style={{
						width: layout.cell,
						height: layout.cell,
						transform: `translate(${layout.offsetX + Math.floor(ringSlot / layout.rows) * (layout.cell + layout.gap)}px, ${layout.offsetY + (ringSlot % layout.rows) * (layout.cell + layout.gap)}px)`,
					}}
				/>
			) : null}

			{createPortal(
				<AnimatePresence>
					{activeDay && dateParts && (
						<motion.div
							ref={tooltipRef}
							layout
							key="tooltip"
							className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md border-[0.5px] border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
							style={{ left: mouseX, top: mouseY, x: tooltipX }}
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							transition={{ duration: 0.15, ease: "easeOut" }}
						>
							<span className="font-semibold">
								<NumberFlow value={activeDay.count} className="tabular-nums" />{" "}
								contribution{activeDay.count !== 1 ? "s" : ""}
							</span>{" "}
							on{" "}
							<AnimatePresence mode="popLayout" initial={false}>
								<motion.span
									key={dateParts.month}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15, ease: "easeOut" }}
									className="inline-block"
								>
									{dateParts.month}
								</motion.span>
							</AnimatePresence>{" "}
							<NumberFlow
								value={dateParts.day}
								suffix={ordinalSuffix(dateParts.day)}
								className="tabular-nums"
							/>
							, {dateParts.year}
						</motion.div>
					)}
				</AnimatePresence>,
				document.body,
			)}
		</div>
	);
}
