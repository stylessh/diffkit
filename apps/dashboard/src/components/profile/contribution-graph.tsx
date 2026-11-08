import { cn } from "@diffkit/ui/lib/utils";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GitHubContributionCalendar } from "#/lib/github.types";

type ContributionGraphProps = {
	calendar: GitHubContributionCalendar;
	className?: string;
};

type CellData = {
	x: number;
	y: number;
	level: 0 | 1 | 2 | 3 | 4;
	date: string;
	count: number;
};

const CELL_SIZE = 11;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;

const LEVEL_COLORS_LIGHT = [
	"oklch(0.93 0.003 286)",
	"oklch(0.84 0.10 150)",
	"oklch(0.72 0.16 150)",
	"oklch(0.58 0.20 150)",
	"oklch(0.42 0.19 150)",
] as const;

const LEVEL_COLORS_DARK = [
	"oklch(0.22 0.005 286)",
	"oklch(0.32 0.09 150)",
	"oklch(0.46 0.15 150)",
	"oklch(0.62 0.20 150)",
	"oklch(0.78 0.22 150)",
] as const;

// Hoisted — string is constant, no reason to rebuild on every render
const CONTRIB_STYLES = `
  :root {
    --contrib-level-0: ${LEVEL_COLORS_LIGHT[0]};
    --contrib-level-1: ${LEVEL_COLORS_LIGHT[1]};
    --contrib-level-2: ${LEVEL_COLORS_LIGHT[2]};
    --contrib-level-3: ${LEVEL_COLORS_LIGHT[3]};
    --contrib-level-4: ${LEVEL_COLORS_LIGHT[4]};
  }
  .dark {
    --contrib-level-0: ${LEVEL_COLORS_DARK[0]};
    --contrib-level-1: ${LEVEL_COLORS_DARK[1]};
    --contrib-level-2: ${LEVEL_COLORS_DARK[2]};
    --contrib-level-3: ${LEVEL_COLORS_DARK[3]};
    --contrib-level-4: ${LEVEL_COLORS_DARK[4]};
  }
`;

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

export function ContributionGraph({
	calendar,
	className,
}: ContributionGraphProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [activeCell, setActiveCell] = useState<CellData | null>(null);
	const activeCellRef = useRef<CellData | null>(null);

	const mouseX = useMotionValue(0);
	const mouseY = useMotionValue(0);
	const tooltipX = useMotionValue(10);

	useLayoutEffect(() => {
		if (!activeCell || !tooltipRef.current) return;
		const w = tooltipRef.current.offsetWidth;
		const overflows = mouseX.get() + 10 + w > window.innerWidth - 8;
		animate(tooltipX, overflows ? -10 - w : 10, {
			duration: 0.15,
			ease: "easeOut",
		});
	}, [activeCell, mouseX, tooltipX]);

	const {
		cells,
		cellsByPosition,
		svgWidth,
		svgHeight,
		centerCol,
		centerRow,
		maxDist,
	} = useMemo(() => {
		const cells: CellData[] = [];
		const cellsByPosition = new Map<string, CellData>();

		for (let weekIdx = 0; weekIdx < calendar.weeks.length; weekIdx++) {
			const week = calendar.weeks[weekIdx];
			for (const day of week.days) {
				const dayOfWeek = new Date(day.date).getUTCDay();
				const cell: CellData = {
					x: weekIdx * CELL_STEP,
					y: dayOfWeek * CELL_STEP,
					level: day.level,
					date: day.date,
					count: day.count,
				};
				cells.push(cell);
				cellsByPosition.set(`${weekIdx}:${dayOfWeek}`, cell);
			}
		}

		const totalCols = calendar.weeks.length;
		const svgWidth = totalCols * CELL_STEP - CELL_GAP;
		const svgHeight = 7 * CELL_STEP - CELL_GAP;
		const centerCol = (totalCols - 1) / 2;
		const centerRow = 3; // (7 - 1) / 2
		const maxDist = Math.sqrt(centerCol ** 2 + centerRow ** 2);

		return {
			cells,
			cellsByPosition,
			svgWidth,
			svgHeight,
			centerCol,
			centerRow,
			maxDist,
		};
	}, [calendar.weeks]);

	const dateParts = useMemo(
		() => (activeCell ? parseDateParts(activeCell.date) : null),
		[activeCell],
	);

	const cellElements = useMemo(
		() =>
			cells.map((cell) => {
				const col = cell.x / CELL_STEP;
				const row = cell.y / CELL_STEP;
				return (
					<motion.rect
						key={cell.date}
						x={cell.x}
						y={cell.y}
						width={CELL_SIZE}
						height={CELL_SIZE}
						rx={2.5}
						className="transition-colors"
						style={
							{
								fill: `var(--contrib-level-${cell.level})`,
								transformOrigin: `${cell.x + CELL_SIZE / 2}px ${cell.y + CELL_SIZE / 2}px`,
							} as React.CSSProperties
						}
						initial={{ scale: 0.65, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{
							type: "spring",
							duration: 1,
							bounce: 0.5,
							delay:
								(Math.sqrt((col - centerCol) ** 2 + (row - centerRow) ** 2) /
									maxDist) *
								0.8,
						}}
					/>
				);
			}),
		[cells, centerCol, centerRow, maxDist],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<SVGSVGElement>) => {
			const svg = svgRef.current;
			if (!svg) return;

			const pt = svg.createSVGPoint();
			pt.x = e.clientX;
			pt.y = e.clientY;
			const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());

			const col = Math.floor(svgPt.x / CELL_STEP);
			const row = Math.floor(svgPt.y / CELL_STEP);

			mouseX.set(e.clientX);
			mouseY.set(e.clientY + 8);

			const cell = cellsByPosition.get(`${col}:${row}`);
			if (!cell) {
				if (activeCellRef.current !== null) {
					activeCellRef.current = null;
					setActiveCell(null);
				}
				return;
			}

			if (activeCellRef.current?.date !== cell.date) {
				activeCellRef.current = cell;
				setActiveCell(cell);
			}
		},
		[cellsByPosition, mouseX, mouseY],
	);

	const handleMouseLeave = useCallback(() => {
		activeCellRef.current = null;
		setActiveCell(null);
	}, []);

	return (
		<div
			className={cn(
				"relative flex items-center justify-center overflow-hidden",
				className,
			)}
		>
			<svg
				ref={svgRef}
				viewBox={`0 0 ${svgWidth} ${svgHeight}`}
				className="h-auto w-full"
				preserveAspectRatio="xMidYMid meet"
				role="img"
				aria-label="Contribution graph"
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				{cellElements}
				<AnimatePresence>
					{activeCell && (
						<motion.rect
							key="ring"
							x={0}
							y={0}
							width={CELL_SIZE}
							height={CELL_SIZE}
							rx={2.5}
							fill="none"
							stroke="var(--primary)"
							strokeWidth={1.5}
							initial={{ opacity: 0, x: activeCell.x, y: activeCell.y }}
							animate={{ opacity: 1, x: activeCell.x, y: activeCell.y }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15, ease: "easeOut" }}
						/>
					)}
				</AnimatePresence>
			</svg>

			{createPortal(
				<AnimatePresence>
					{activeCell && dateParts && (
						<motion.div
							ref={tooltipRef}
							layout
							key="tooltip"
							className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md border-[0.5px] border-border"
							style={{ left: mouseX, top: mouseY, x: tooltipX }}
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							transition={{ duration: 0.15, ease: "easeOut" }}
						>
							<span className="font-semibold">
								<NumberFlow value={activeCell.count} className="tabular-nums" />{" "}
								contribution{activeCell.count !== 1 ? "s" : ""}
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

			<style>{CONTRIB_STYLES}</style>
		</div>
	);
}
