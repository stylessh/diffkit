import { motion, useReducedMotion } from "motion/react";
import { type RefObject, useLayoutEffect, useState } from "react";
import { plural } from "./map-format";

export type WireKind = "uses" | "used-by" | "outside";

export type WireLink = {
	from: string;
	to: string;
	kind: WireKind;
};

type Box = {
	left: number;
	right: number;
	top: number;
	bottom: number;
	centerX: number;
	centerY: number;
};

type Wire = WireLink & { d: string; endX: number; endY: number };

export type NodeRegistry = RefObject<Map<string, HTMLElement>>;

function boxWithin(element: HTMLElement, container: HTMLElement): Box {
	const rect = element.getBoundingClientRect();
	const origin = container.getBoundingClientRect();
	const left = rect.left - origin.left;
	const top = rect.top - origin.top;
	return {
		left,
		top,
		right: left + rect.width,
		bottom: top + rect.height,
		centerX: left + rect.width / 2,
		centerY: top + rect.height / 2,
	};
}

function curveBetween(from: Box, to: Box) {
	if (to.top >= from.bottom - 4) {
		const bend = Math.max(20, (to.top - from.bottom) / 2);
		return {
			d: `M${from.centerX},${from.bottom} C${from.centerX},${from.bottom + bend} ${to.centerX},${to.top - bend} ${to.centerX},${to.top}`,
			endX: to.centerX,
			endY: to.top,
		};
	}
	if (to.bottom <= from.top + 4) {
		const bend = Math.max(20, (from.top - to.bottom) / 2);
		return {
			d: `M${from.centerX},${from.top} C${from.centerX},${from.top - bend} ${to.centerX},${to.bottom + bend} ${to.centerX},${to.bottom}`,
			endX: to.centerX,
			endY: to.bottom,
		};
	}
	const direction = to.left > from.left ? 1 : -1;
	const startX = direction === 1 ? from.right : from.left;
	const endX = direction === 1 ? to.left : to.right;
	const bend = Math.max(12, Math.abs(endX - startX) / 2) * direction;
	return {
		d: `M${startX},${from.centerY} C${startX + bend},${from.centerY} ${endX - bend},${to.centerY} ${endX},${to.centerY}`,
		endX,
		endY: to.centerY,
	};
}

function useWires(
	containerRef: RefObject<HTMLDivElement | null>,
	nodes: NodeRegistry,
	links: WireLink[],
) {
	const [wires, setWires] = useState<Wire[]>([]);

	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container || links.length === 0) {
			setWires([]);
			return;
		}
		const measure = () => {
			const next: Wire[] = [];
			for (const link of links) {
				const from = nodes.current.get(link.from);
				const to = nodes.current.get(link.to);
				if (!(from && to)) continue;
				next.push({
					...link,
					...curveBetween(boxWithin(from, container), boxWithin(to, container)),
				});
			}
			setWires(next);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(container);
		return () => observer.disconnect();
	}, [containerRef, nodes, links]);

	return wires;
}

const wireClassName: Record<WireKind, string> = {
	uses: "text-indigo",
	"used-by": "text-muted-foreground",
	outside: "text-text-header",
};

export function MapWires({
	containerRef,
	nodes,
	links,
}: {
	containerRef: RefObject<HTMLDivElement | null>;
	nodes: NodeRegistry;
	links: WireLink[];
}) {
	const wires = useWires(containerRef, nodes, links);
	const reduceMotion = useReducedMotion();

	return (
		<svg
			role="img"
			aria-label={`${plural(wires.length, "connection")} from the focused area`}
			className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
		>
			{wires.map((wire) => (
				<g key={`${wire.from}>${wire.to}`} className={wireClassName[wire.kind]}>
					<motion.path
						d={wire.d}
						fill="none"
						stroke="currentColor"
						strokeWidth={wire.kind === "uses" ? 1.5 : 1}
						strokeLinecap="round"
						strokeDasharray={wire.kind === "uses" ? "5 5" : "2 5"}
						initial={{ opacity: 0, strokeDashoffset: 0 }}
						animate={{
							opacity: wire.kind === "uses" ? 0.95 : 0.6,
							strokeDashoffset: reduceMotion ? 0 : -40,
						}}
						transition={{
							opacity: { duration: 0.18 },
							strokeDashoffset: {
								duration: 1.6,
								ease: "linear",
								repeat: Number.POSITIVE_INFINITY,
							},
						}}
					/>
					<circle cx={wire.endX} cy={wire.endY} r={2.5} fill="currentColor" />
				</g>
			))}
		</svg>
	);
}
