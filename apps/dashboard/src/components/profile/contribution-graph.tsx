import { cn } from "@diffkit/ui/lib/utils";
import { motion } from "motion/react";
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

type TooltipState = {
	cell: CellData;
	pageX: number;
	pageY: number;
};

const CELL_SIZE = 11;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;

const LEVEL_COLORS_LIGHT = [
	"oklch(0.82 0.005 286)",
	"oklch(0.82 0.12 150)",
	"oklch(0.72 0.16 150)",
	"oklch(0.60 0.19 150)",
	"oklch(0.48 0.19 150)",
] as const;

const LEVEL_COLORS_DARK = [
	"oklch(0.25 0.006 286)",
	"oklch(0.35 0.10 150)",
	"oklch(0.45 0.14 150)",
	"oklch(0.55 0.17 150)",
	"oklch(0.65 0.19 150)",
] as const;

function formatDate(dateStr: string) {
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function ContributionGraph({
	calendar,
	className,
}: ContributionGraphProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const [tooltip, setTooltip] = useState<TooltipState | null>(null);
	const [tooltipLeft, setTooltipLeft] = useState(0);

	useLayoutEffect(() => {
		if (!tooltip || !tooltipRef.current) return;
		const el = tooltipRef.current;
		const halfWidth = el.offsetWidth / 2;
		const padding = 8;
		let left = tooltip.pageX;

		if (left - halfWidth < padding) {
			left = halfWidth + padding;
		} else if (left + halfWidth > window.innerWidth - padding) {
			left = window.innerWidth - halfWidth - padding;
		}

		setTooltipLeft(left);
	}, [tooltip]);

	const { cells, cellsByDate } = useMemo(() => {
		const result: CellData[] = [];
		const map = new Map<string, CellData>();

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
				result.push(cell);
				map.set(day.date, cell);
			}
		}

		return { cells: result, cellsByDate: map };
	}, [calendar.weeks]);

	const totalCols = calendar.weeks.length;
	const totalRows = 7;
	const centerCol = (totalCols - 1) / 2;
	const centerRow = (totalRows - 1) / 2;
	// Max distance from center for normalization (corner cell)
	const maxDist = Math.sqrt(centerCol ** 2 + centerRow ** 2);

	const svgWidth = totalCols * CELL_STEP - CELL_GAP;
	const svgHeight = totalRows * CELL_STEP - CELL_GAP;

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

			// Check the point is within a cell, not in the gap
			const cellX = svgPt.x - col * CELL_STEP;
			const cellY = svgPt.y - row * CELL_STEP;
			if (cellX > CELL_SIZE || cellY > CELL_SIZE || cellX < 0 || cellY < 0) {
				setTooltip(null);
				return;
			}

			const week = calendar.weeks[col];
			if (!week) {
				setTooltip(null);
				return;
			}

			const day = week.days.find((d) => new Date(d.date).getUTCDay() === row);
			if (!day) {
				setTooltip(null);
				return;
			}

			const cell = cellsByDate.get(day.date);
			if (!cell) {
				setTooltip(null);
				return;
			}

			setTooltip({ cell, pageX: e.clientX, pageY: e.clientY });
		},
		[calendar.weeks, cellsByDate],
	);

	const handleMouseLeave = useCallback(() => {
		setTooltip(null);
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
				{cells.map((cell) => {
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
							initial={{ scale: 0.96, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{
								type: "spring",
								duration: 0.8,
								bounce: 0.5,
								delay:
									(Math.sqrt((col - centerCol) ** 2 + (row - centerRow) ** 2) /
										maxDist) *
									0.8,
							}}
						/>
					);
				})}
			</svg>

			{tooltip &&
				createPortal(
					<div
						ref={tooltipRef}
						className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md border border-border"
						style={{
							left: tooltipLeft,
							top: tooltip.pageY - 8,
							transform: "translate(-50%, -100%)",
						}}
					>
						<span className="font-semibold">
							{tooltip.cell.count} contribution
							{tooltip.cell.count !== 1 ? "s" : ""}
						</span>{" "}
						on {formatDate(tooltip.cell.date)}
					</div>,
					document.body,
				)}

			<style>{`
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
			`}</style>
		</div>
	);
}
