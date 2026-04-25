import type { GraphEdge } from "./types";

export function collectConnectedEdgeIds(
	nodeId: string,
	edges: GraphEdge[],
): Set<string> {
	const result = new Set<string>();
	const forward = [nodeId];
	while (forward.length > 0) {
		const current = forward.pop();
		if (!current) break;
		for (const edge of edges) {
			if (edge.source === current && !result.has(edge.id)) {
				result.add(edge.id);
				forward.push(edge.target);
			}
		}
	}
	const backward = [nodeId];
	while (backward.length > 0) {
		const current = backward.pop();
		if (!current) break;
		for (const edge of edges) {
			if (edge.target === current && !result.has(edge.id)) {
				result.add(edge.id);
				backward.push(edge.source);
			}
		}
	}
	return result;
}
