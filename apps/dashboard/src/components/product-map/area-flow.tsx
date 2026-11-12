import { ChevronLeftIcon, ChevronRightIcon } from "@diffkit/icons";
import { cn } from "@diffkit/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import {
	type CSSProperties,
	type ReactNode,
	useEffect,
	useReducer,
	useRef,
} from "react";
import { CodeLink, type RepoLinks } from "./code-link";
import { stepKind } from "./map-icons";
import type { FlowStep } from "./product-map-types";

const LANES = [
	{
		label: "In the browser",
		icon: "client",
		kinds: ["page", "component", "client"],
	},
	{ label: "On the Worker", icon: "server", kinds: ["server", "route"] },
	{
		label: "GitHub and storage",
		icon: "storage",
		kinds: ["github", "storage", "external"],
	},
	{ label: "Tooling", icon: "tool", kinds: ["tool"] },
];

const LANE_HEIGHT = 124;
const LANE_GAP = 8;
const NODE_TOP = 38;
const NODE_SIZE = 36;
const NODE_CENTER = NODE_TOP + NODE_SIZE / 2;
const TRAVEL_MS = 2200;
/** Opaque, so a lane label can cover a connector that passes behind it. */
const LANE_SURFACE =
	"bg-[color-mix(in_oklab,var(--color-foreground)_3%,var(--color-main))]";

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

/** Lets a camelCase identifier wrap between its words instead of mid-word. */
function wrappable(label: string) {
	return label.replace(/([a-z0-9])([A-Z])/g, "$1​$2");
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
	const pitch = LANE_HEIGHT + LANE_GAP;
	const fromY = fromRow * pitch + NODE_CENTER;
	const toY = toRow * pitch + NODE_CENTER;
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
				d={`M0,${fromY} C60,${fromY} 40,${toY} 100,${toY}`}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

function StepButton({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-item-hover hover:text-foreground"
		>
			{children}
		</button>
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

	const scrollerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const scroller = scrollerRef.current;
		const node = scroller?.querySelector<HTMLElement>(
			`[data-step="${state.step}"]`,
		);
		if (!(scroller && node)) return;
		const centre =
			node.getBoundingClientRect().left -
			scroller.getBoundingClientRect().left +
			scroller.scrollLeft +
			node.offsetWidth / 2;
		scroller.scrollTo({
			left: centre - scroller.clientWidth / 2,
			behavior: "smooth",
		});
	}, [state.step]);

	const usedLanes = LANES.map((lane, index) => ({ ...lane, index })).filter(
		(lane) => steps.some((step) => laneOf(step.kind) === lane.index),
	);
	const rowOf = (step: FlowStep) =>
		usedLanes.findIndex((lane) => lane.index === laneOf(step.kind));
	const height = usedLanes.length * (LANE_HEIGHT + LANE_GAP) - LANE_GAP;
	const selected = steps[state.step];
	const SelectedIcon = stepKind(selected.kind).icon;
	const holdAt = (step: number) =>
		dispatch({ type: "hold", step: (step + steps.length) % steps.length });

	return (
		<div className="flex flex-col gap-4">
			<div ref={scrollerRef} className="no-scrollbar overflow-x-auto">
				<div
					className="relative"
					style={{ minWidth: `${steps.length * 6.5}rem`, height }}
				>
					{usedLanes.map((lane, row) => {
						const LaneIcon = stepKind(lane.icon).icon;
						return (
							<div
								key={lane.label}
								className={cn("absolute inset-x-0 rounded-xl", LANE_SURFACE)}
								style={{
									top: row * (LANE_HEIGHT + LANE_GAP),
									height: LANE_HEIGHT,
								}}
							>
								<span
									className={cn(
										"sticky left-2 z-10 mt-2 ml-2 inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 font-[450] text-muted-foreground text-xs",
										LANE_SURFACE,
									)}
								>
									<LaneIcon size={12} strokeWidth={2} />
									{lane.label}
								</span>
							</div>
						);
					})}
					<div
						className="absolute inset-x-3 inset-y-0 grid"
						style={{
							gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
							gridTemplateRows: `repeat(${usedLanes.length}, ${LANE_HEIGHT}px)`,
							rowGap: LANE_GAP,
						}}
					>
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
							const reached = index < state.step;
							const hold = () => dispatch({ type: "hold", step: index });
							return (
								<button
									key={`${step.kind}:${step.label}`}
									type="button"
									data-step={index}
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
											paddingTop: NODE_TOP,
										} as CSSProperties
									}
									className="group/step relative flex min-w-0 flex-col items-center gap-2 outline-none"
								>
									<span
										className={cn(
											"-outline-offset-1 flex size-9 items-center justify-center rounded-full bg-button text-muted-foreground shadow-button transition-colors group-focus-visible/step:outline-2 group-focus-visible/step:outline-focus group-focus-visible/step:outline-solid",
											reached && "text-foreground",
											active &&
												"text-indigo outline-[1.5px] outline-indigo outline-solid",
										)}
									>
										<Icon size={15} strokeWidth={2} />
									</span>
									<span
										className={cn(
											"line-clamp-2 max-w-[4.75rem] text-center font-[450] text-[11px] leading-[14px] transition-colors [overflow-wrap:anywhere]",
											active ? "text-foreground" : "text-muted-foreground",
										)}
									>
										{wrappable(step.label)}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			</div>
			<div className="flex min-h-[5.5rem] items-start gap-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-group text-foreground">
					<SelectedIcon size={15} strokeWidth={2} />
				</span>
				<div className="flex min-w-0 flex-1 flex-col items-start gap-1">
					<span className="font-[450] text-muted-foreground text-xs">
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
				<div className="flex shrink-0 items-center gap-0.5">
					<StepButton
						label="Previous step"
						onClick={() => holdAt(state.step - 1)}
					>
						<ChevronLeftIcon size={14} strokeWidth={2} />
					</StepButton>
					<span className="min-w-8 text-center font-[450] text-muted-foreground text-xs tabular-nums">
						{state.step + 1} / {steps.length}
					</span>
					<StepButton label="Next step" onClick={() => holdAt(state.step + 1)}>
						<ChevronRightIcon size={14} strokeWidth={2} />
					</StepButton>
				</div>
			</div>
		</div>
	);
}
