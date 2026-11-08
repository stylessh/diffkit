import {
	type ComponentProps,
	createContext,
	type ReactNode,
	useContext,
} from "react";

import { cn } from "../lib/utils";

/**
 * Elevation level (1 = app shell). Levels map onto Linear's layers:
 * 1 shell → 2 main pane → 3 card → 4 raised pill → 5+ floating overlay.
 */
export type FluidSurfaceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const FluidSurfaceSubstrateContext = createContext<number>(1);

/** Current substrate level for relative elevation (default 1). */
export function useFluidSurfaceSubstrate(): number {
	return useContext(FluidSurfaceSubstrateContext);
}

const fluidSurfaceLevelClasses: Record<FluidSurfaceLevel, string> = {
	1: "bg-shell",
	2: "bg-main shadow-main",
	3: "bg-card shadow-card",
	4: "bg-button shadow-button",
	5: "bg-popover shadow-popover",
	6: "bg-popover shadow-popover",
	7: "bg-popover shadow-popover",
	8: "bg-popover shadow-popover",
};

function clampLevel(n: number): FluidSurfaceLevel {
	return Math.min(8, Math.max(1, Math.round(n))) as FluidSurfaceLevel;
}

/** Tailwind classes for a fixed elevation level (pair bg + shadow). */
export function fluidSurfaceClasses(level: number): string {
	return fluidSurfaceLevelClasses[clampLevel(level)];
}

/** Override substrate for a subtree (e.g. preview inside a forced level). */
export function FluidSurfaceRoot({
	level,
	children,
}: {
	level: FluidSurfaceLevel;
	children: ReactNode;
}) {
	return (
		<FluidSurfaceSubstrateContext.Provider value={level}>
			{children}
		</FluidSurfaceSubstrateContext.Provider>
	);
}

/** Fixed level (e.g. dialog ≈ 5, selected tab pill ≈ 4). Re-provides this level as substrate to children. */
export function FluidSurfaceAt({
	level,
	className,
	children,
	...props
}: {
	level: FluidSurfaceLevel;
	children: ReactNode;
} & ComponentProps<"div">) {
	const l = clampLevel(level);
	return (
		<FluidSurfaceSubstrateContext.Provider value={l}>
			<div className={cn(fluidSurfaceClasses(l), className)} {...props}>
				{children}
			</div>
		</FluidSurfaceSubstrateContext.Provider>
	);
}

/**
 * Renders at `substrate + offset`, capped at 8, and re-provides that level as the new substrate
 * for nested elevated UI (matches Fluid’s relative elevation model).
 */
export function FluidSurfaceElevated({
	offset,
	className,
	children,
	...props
}: {
	offset: number;
	children: ReactNode;
} & ComponentProps<"div">) {
	const substrate = useFluidSurfaceSubstrate();
	const level = clampLevel(substrate + offset);
	return (
		<FluidSurfaceSubstrateContext.Provider value={level}>
			<div className={cn(fluidSurfaceClasses(level), className)} {...props}>
				{children}
			</div>
		</FluidSurfaceSubstrateContext.Provider>
	);
}
