import {
	ChevronLeftIcon,
	ChevronRightIcon,
	PauseIcon,
	PlayIcon,
	XIcon,
} from "@diffkit/icons";
import { PageIconButton } from "@diffkit/ui/components/page-header";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import type { TourStop } from "./product-map-types";

export const TOUR_STOP_MS = 7500;

export type TourState =
	| { status: "idle" }
	| { status: "playing"; stop: number }
	| { status: "paused"; stop: number };

export type TourAction =
	| { type: "start" }
	| { type: "stop" }
	| { type: "toggle" }
	| { type: "next"; stops: number }
	| { type: "previous" }
	| { type: "go"; stop: number };

export const TOUR_IDLE: TourState = { status: "idle" };

export function tourReducer(state: TourState, action: TourAction): TourState {
	if (action.type === "start") return { status: "playing", stop: 0 };
	if (action.type === "stop" || state.status === "idle") return TOUR_IDLE;
	if (action.type === "toggle")
		return {
			status: state.status === "playing" ? "paused" : "playing",
			stop: state.stop,
		};
	if (action.type === "next")
		return state.stop + 1 >= action.stops
			? TOUR_IDLE
			: { status: state.status, stop: state.stop + 1 };
	if (action.type === "previous")
		return { status: state.status, stop: Math.max(0, state.stop - 1) };
	return { status: "paused", stop: action.stop };
}

function useAutoAdvance(
	state: TourState,
	stops: number,
	dispatch: (action: TourAction) => void,
) {
	const playingStop = state.status === "playing" ? state.stop : null;
	useEffect(() => {
		if (playingStop === null) return;
		const timer = window.setTimeout(
			() => dispatch({ type: "next", stops }),
			TOUR_STOP_MS,
		);
		return () => window.clearTimeout(timer);
	}, [playingStop, stops, dispatch]);
}

function TourProgress({
	state,
	stops,
	dispatch,
}: {
	state: Exclude<TourState, { status: "idle" }>;
	stops: TourStop[];
	dispatch: (action: TourAction) => void;
}) {
	const reduceMotion = useReducedMotion();
	return (
		<div className="flex gap-1">
			{stops.map((stop, index) => (
				<button
					key={stop.title}
					type="button"
					aria-label={`Go to stop ${index + 1}: ${stop.title}`}
					onClick={() => dispatch({ type: "go", stop: index })}
					className="h-3 flex-1 py-1"
				>
					<span className="block h-full overflow-hidden rounded-full bg-card-border">
						{index < state.stop ? (
							<span className="block size-full bg-indigo" />
						) : null}
						{index === state.stop ? (
							<motion.span
								key={`${state.status}:${state.stop}`}
								className="block size-full origin-left bg-indigo"
								initial={{ scaleX: state.status === "paused" ? 1 : 0 }}
								animate={{ scaleX: 1 }}
								transition={{
									duration:
										state.status === "paused" || reduceMotion
											? 0
											: TOUR_STOP_MS / 1000,
									ease: "linear",
								}}
							/>
						) : null}
					</span>
				</button>
			))}
		</div>
	);
}

export function TourBar({
	state,
	stops,
	dispatch,
}: {
	state: TourState;
	stops: TourStop[];
	dispatch: (action: TourAction) => void;
}) {
	useAutoAdvance(state, stops.length, dispatch);
	if (state.status === "idle") return null;
	const stop = stops[state.stop];

	return (
		<motion.div
			role="region"
			aria-label="Product tour"
			initial={{ opacity: 0, y: 16 }}
			animate={{ opacity: 1, y: 0 }}
			className="absolute inset-x-0 bottom-4 z-30 mx-auto flex w-[min(42rem,calc(100%-1.5rem))] flex-col gap-2 rounded-xl bg-popover/85 p-3 shadow-popover backdrop-blur-xl"
		>
			<TourProgress state={state} stops={stops} dispatch={dispatch} />
			<div className="flex items-start gap-3 max-sm:flex-col-reverse max-sm:gap-1">
				<div aria-live="polite" className="min-w-0 flex-1">
					<p className="font-medium text-[13px] text-foreground">
						<span className="mr-1.5 text-muted-foreground tabular-nums">
							{state.stop + 1}/{stops.length}
						</span>
						{stop.title}
					</p>
					<p className="mt-0.5 text-pretty text-[13px] text-text-header leading-[1.5]">
						{stop.text}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-0.5 max-sm:self-end">
					<PageIconButton
						aria-label="Previous stop"
						disabled={state.stop === 0}
						onClick={() => dispatch({ type: "previous" })}
					>
						<ChevronLeftIcon size={14} />
					</PageIconButton>
					<PageIconButton
						aria-label={state.status === "playing" ? "Pause tour" : "Play tour"}
						onClick={() => dispatch({ type: "toggle" })}
					>
						{state.status === "playing" ? (
							<PauseIcon size={14} />
						) : (
							<PlayIcon size={14} />
						)}
					</PageIconButton>
					<PageIconButton
						aria-label="Next stop"
						onClick={() => dispatch({ type: "next", stops: stops.length })}
					>
						<ChevronRightIcon size={14} />
					</PageIconButton>
					<PageIconButton
						aria-label="End tour"
						onClick={() => dispatch({ type: "stop" })}
					>
						<XIcon size={14} />
					</PageIconButton>
				</div>
			</div>
		</motion.div>
	);
}
