export type SafePolygonPoint = {
	x: number;
	y: number;
};

export type SafePolygonRect = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

export type SafePolygonSide = "top" | "right" | "bottom" | "left";

export type SafePolygon = readonly [
	SafePolygonPoint,
	SafePolygonPoint,
	SafePolygonPoint,
];

export function toSafePolygonRect(rect: DOMRect): SafePolygonRect {
	return {
		top: rect.top,
		right: rect.right,
		bottom: rect.bottom,
		left: rect.left,
	};
}

export function getSubmenuSide(
	source: SafePolygonRect,
	destination: SafePolygonRect,
): SafePolygonSide {
	const horizontalGap = Math.max(
		destination.left - source.right,
		source.left - destination.right,
	);
	const verticalGap = Math.max(
		destination.top - source.bottom,
		source.top - destination.bottom,
	);

	if (horizontalGap >= verticalGap) {
		const sourceCenter = (source.left + source.right) / 2;
		const destinationCenter = (destination.left + destination.right) / 2;
		return destinationCenter >= sourceCenter ? "right" : "left";
	}

	const sourceCenter = (source.top + source.bottom) / 2;
	const destinationCenter = (destination.top + destination.bottom) / 2;
	return destinationCenter >= sourceCenter ? "bottom" : "top";
}

/**
 * Creates the triangular corridor from the pointer's exit point to the near
 * edge of a submenu. The buffer is applied only at the destination edge so
 * nearby sibling rows remain immediately reachable near the source.
 */
export function createSafePolygon(
	exitPoint: SafePolygonPoint,
	destination: SafePolygonRect,
	side: SafePolygonSide,
	buffer = 8,
): SafePolygon {
	switch (side) {
		case "left":
			return [
				exitPoint,
				{ x: destination.right, y: destination.top - buffer },
				{ x: destination.right, y: destination.bottom + buffer },
			];
		case "top":
			return [
				exitPoint,
				{ x: destination.left - buffer, y: destination.bottom },
				{ x: destination.right + buffer, y: destination.bottom },
			];
		case "bottom":
			return [
				exitPoint,
				{ x: destination.left - buffer, y: destination.top },
				{ x: destination.right + buffer, y: destination.top },
			];
		case "right":
			return [
				exitPoint,
				{ x: destination.left, y: destination.top - buffer },
				{ x: destination.left, y: destination.bottom + buffer },
			];
	}
}

function isPointOnSegment(
	point: SafePolygonPoint,
	start: SafePolygonPoint,
	end: SafePolygonPoint,
) {
	const cross =
		(point.y - start.y) * (end.x - start.x) -
		(point.x - start.x) * (end.y - start.y);
	if (Math.abs(cross) > Number.EPSILON * 100) return false;

	return (
		point.x >= Math.min(start.x, end.x) &&
		point.x <= Math.max(start.x, end.x) &&
		point.y >= Math.min(start.y, end.y) &&
		point.y <= Math.max(start.y, end.y)
	);
}

/** Ray-casting point-in-polygon with inclusive edges. */
export function isPointInSafePolygon(
	point: SafePolygonPoint,
	polygon: readonly SafePolygonPoint[],
) {
	let inside = false;

	for (
		let index = 0, previous = polygon.length - 1;
		index < polygon.length;
		previous = index++
	) {
		const start = polygon[previous];
		const end = polygon[index];
		if (!(start && end)) continue;
		if (isPointOnSegment(point, start, end)) return true;

		const crossesRay =
			start.y > point.y !== end.y > point.y &&
			point.x <
				((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;
		if (crossesRay) inside = !inside;
	}

	return inside;
}

export function isPointInSafePolygonRect(
	point: SafePolygonPoint,
	rect: SafePolygonRect,
) {
	return (
		point.x >= rect.left &&
		point.x <= rect.right &&
		point.y >= rect.top &&
		point.y <= rect.bottom
	);
}

export function isMovingTowardSubmenu(
	previous: SafePolygonPoint,
	current: SafePolygonPoint,
	side: SafePolygonSide,
	tolerance = 4,
) {
	switch (side) {
		case "left":
			return current.x <= previous.x + tolerance;
		case "top":
			return current.y <= previous.y + tolerance;
		case "bottom":
			return current.y >= previous.y - tolerance;
		case "right":
			return current.x >= previous.x - tolerance;
	}
}
