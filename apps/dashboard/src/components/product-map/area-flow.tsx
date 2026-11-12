import { cn } from "@diffkit/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { type CSSProperties, useEffect, useReducer } from "react";
import { CodeLink, type RepoLinks } from "./code-link";
import { stepKind } from "./map-icons";
import type { FlowStep } from "./product-map-types";

const LANES = [
	{ label: "In the browser", kinds: ["page", "component", "client"] },
	{ label: "On the Worker", kinds: ["server", "route"] },
	{ label: "GitHub and storage", kinds: ["github", "storage", "external"] },
	{ label: "Tooling", kinds: ["tool"] },
];

const LANE_HEIGHT = 100;
const NODE_CENTER = 44;
const TRAVEL_MS = 2200;

type FlowState =
	| { mode: "travelling"; step: number }
	| { mode: "held"; step: number };

type FlowAction =
	| { type: "advance"; steps: number }
	| { type: "hold"; step: number };

function flowReducer(state: FlowState, action: FlowAction): FlowState {
	if (action.type === "hold") return { mode: "held", step: action.step };
	if (state.mode === "held") return state;
	return { mode: "travelling", step: (state.step + 1) % action.steps };
}

function laneOf(kind: string) {
	const lane = LANES.findIndex((candidate) => candidate.kinds.includes(kind));
	return lane === -1 ? 0 : lane;
}

function Connector({
	index,
	steps,
	fromRow,
	toRow,
	height,
	reached,
}: {
	index: number;
	steps: number;
	fromRow: number;
	toRow: number;
	height: number;
	reached: boolean;
}) {
	const fromY = fromRow * LANE_HEIGHT + NODE_CENTER;
	const toY = toRow * LANE_HEIGHT + NODE_CENTER;
	return (
		<svg
			aria-hidden="true"
			viewBox={`0 0 100 ${height}`}
			preserveAspectRatio="none"
			className={cn(
				"pointer-events-none absolute top-0 transition-colors duration-300",
				reached ? "text-indigo" : "text-card-border",
			)}
			style={{
				left: `${((index + 0.5) / steps) * 100}%`,
				width: `${100 / steps}%`,
				height,
			}}
		>
			<path
				d={`M0,${fromY} C50,${fromY} 50,${toY} 100,${toY}`}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.25}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

export function AreaFlow({
	steps,
	repo,
}: {
	steps: FlowStep[];
	repo: RepoLinks;
}) {
	const reduceMotion = useReducedMotion();
	const [state, dispatch] = useReducer(
		flowReducer,
		reduceMotion ? { mode: "held", step: 0 } : { mode: "travelling", step: 0 },
	);

	useEffect(() => {
		if (state.mode !== "travelling") return;
		const timer = window.setInterval(
			() => dispatch({ type: "advance", steps: steps.length }),
			TRAVEL_MS,
		);
		return () => window.clearInterval(timer);
	}, [state.mode, steps.length]);

	const usedLanes = LANES.map((lane, index) => ({ ...lane, index })).filter(
		(lane) => steps.some((step) => laneOf(step.kind) === lane.index),
	);
	const rowOf = (step: FlowStep) =>
		usedLanes.findIndex((lane) => lane.index === laneOf(step.kind));
	const height = usedLanes.length * LANE_HEIGHT;
	const selected = steps[state.step];

	return (
		<div>
			<div className="flex px-3 pt-3">
				<div
					aria-hidden
					className="grid w-[6.5rem] shrink-0 max-sm:hidden"
					style={{
						gridTemplateRows: `repeat(${usedLanes.length}, ${LANE_HEIGHT}px)`,
					}}
				>
					{usedLanes.map((lane) => (
						<span
							key={lane.label}
							className="pt-[34px] pl-1 font-[450] text-muted-foreground text-xs leading-5"
						>
							{lane.label}
						</span>
					))}
				</div>
				<div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
					<div
						className="relative grid"
						style={{
							minWidth: `${steps.length * 5.75}rem`,
							gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
							gridTemplateRows: `repeat(${usedLanes.length}, ${LANE_HEIGHT}px)`,
						}}
					>
						{usedLanes.map((lane, row) => (
							<div
								key={lane.label}
								className="absolute inset-x-0 rounded-lg bg-foreground/[0.035] px-2.5 pt-1.5 font-[450] text-[11px] text-muted-foreground"
								style={{ top: row * LANE_HEIGHT, height: LANE_HEIGHT - 6 }}
							>
								<span className="sticky left-2.5 sm:hidden">{lane.label}</span>
							</div>
						))}
						{steps.slice(1).map((step, index) => (
							<Connector
								key={`${step.kind}:${step.label}`}
								index={index}
								steps={steps.length}
								fromRow={rowOf(steps[index])}
								toRow={rowOf(step)}
								height={height}
								reached={index < state.step}
							/>
						))}
						{steps.map((step, index) => {
							const Icon = stepKind(step.kind).icon;
							const active = index === state.step;
							const hold = () => dispatch({ type: "hold", step: index });
							return (
								<button
									key={`${step.kind}:${step.label}`}
									type="button"
									aria-pressed={active}
									onClick={hold}
									onFocus={hold}
									onPointerEnter={(event) => {
										if (event.pointerType === "mouse") hold();
									}}
									style={
										{
											gridColumn: index + 1,
											gridRow: rowOf(step) + 1,
										} as CSSProperties
									}
									className="group/step relative flex flex-col items-center gap-1.5 pt-[26px] outline-none"
								>
									<span
										className={cn(
											"-outline-offset-1 flex size-9 items-center justify-center rounded-full bg-button text-muted-foreground shadow-button transition-colors group-focus-visible/step:outline-2 group-focus-visible/step:outline-focus group-focus-visible/step:outline-solid",
											active &&
												"text-foreground outline-[1.5px] outline-indigo outline-solid",
										)}
									>
										<Icon size={15} strokeWidth={2} />
									</span>
									<span
										className={cn(
											"line-clamp-2 px-1 text-center font-[450] text-[11px] leading-[14px] transition-colors",
											active ? "text-foreground" : "text-muted-foreground",
										)}
									>
										{step.label}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			</div>
			<div className="flex min-h-[7rem] flex-col items-start gap-1 px-4 pt-3 pb-3">
				<span className="font-[450] text-muted-foreground text-xs">
					Step {state.step + 1} of {steps.length} ·{" "}
					{stepKind(selected.kind).label}
				</span>
				<p className="text-pretty text-[13px] text-foreground leading-5">
					{selected.note}
				</p>
				{selected.path ? (
					<span className="pt-1">
						<CodeLink reference={{ path: selected.path }} repo={repo} />
					</span>
				) : null}
			</div>
		</div>
	);
}
