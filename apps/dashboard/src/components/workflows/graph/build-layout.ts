import type { Node } from "@xyflow/react";
import type {
	WorkflowDefinition,
	WorkflowDefinitionJob,
	WorkflowRunJob,
} from "#/lib/github.types";
import { COLUMN_GAP, NODE_WIDTH, ROW_GAP } from "./constants";
import { buildNameMatcher, getAggregateState } from "./grouping";
import { estimateNodeHeight } from "./height";
import type { FlowNode, GraphEdge, JobNodeData, MatrixNodeData } from "./types";

export type DefGraphLayout = {
	nodes: FlowNode[];
	edges: GraphEdge[];
};

export function buildLayoutFromDefinition(
	jobs: WorkflowRunJob[],
	definition: WorkflowDefinition,
	collapsedIds: Set<string>,
): DefGraphLayout | null {
	const matchedJobsByKey = new Map<string, WorkflowRunJob[]>();
	const claimedJobIds = new Set<number>();

	for (const yamlJob of definition.jobs) {
		const matcher = buildNameMatcher(
			yamlJob.nameTemplate,
			yamlJob.key,
			yamlJob.isMatrix,
		);
		const matches: WorkflowRunJob[] = [];
		for (const job of jobs) {
			if (claimedJobIds.has(job.id)) continue;
			if (matcher(job.name)) {
				matches.push(job);
				claimedJobIds.add(job.id);
			}
		}
		matchedJobsByKey.set(yamlJob.key, matches);
	}

	if (claimedJobIds.size === 0) return null;

	type DefNode = {
		key: string;
		def: WorkflowDefinitionJob;
		matched: WorkflowRunJob[];
	};
	const defNodes: DefNode[] = [];
	for (const yamlJob of definition.jobs) {
		const matched = matchedJobsByKey.get(yamlJob.key) ?? [];
		if (matched.length > 0) {
			defNodes.push({ key: yamlJob.key, def: yamlJob, matched });
		}
	}

	const keyToDefNode = new Map(defNodes.map((n) => [n.key, n]));
	const layerByKey = new Map<string, number>();
	const visiting = new Set<string>();
	const computeLayer = (key: string): number => {
		const cached = layerByKey.get(key);
		if (cached != null) return cached;
		if (visiting.has(key)) return 0;
		visiting.add(key);
		const node = keyToDefNode.get(key);
		const needs = node?.def.needs ?? [];
		const validNeeds = needs.filter((n) => keyToDefNode.has(n));
		const layer =
			validNeeds.length > 0
				? Math.max(...validNeeds.map((n) => computeLayer(n))) + 1
				: 0;
		visiting.delete(key);
		layerByKey.set(key, layer);
		return layer;
	};
	for (const node of defNodes) computeLayer(node.key);

	const layersMap = new Map<number, DefNode[]>();
	for (const node of defNodes) {
		const layer = layerByKey.get(node.key) ?? 0;
		const bucket = layersMap.get(layer) ?? [];
		bucket.push(node);
		layersMap.set(layer, bucket);
	}

	const sortedLayers = [...layersMap.keys()].sort((a, b) => a - b);
	const flowNodes: FlowNode[] = [];
	for (const layer of sortedLayers) {
		const layerNodes = layersMap.get(layer) ?? [];
		const x = layer * (NODE_WIDTH + COLUMN_GAP);
		let currentY = 0;
		for (const node of layerNodes) {
			const nodeId = `def-${node.key}`;
			const isMatrixNode = node.matched.length > 1 || node.def.isMatrix;
			let flowNode: FlowNode | null = null;
			if (isMatrixNode) {
				flowNode = {
					id: nodeId,
					type: "matrix",
					position: { x, y: currentY },
					data: {
						baseName: node.key,
						jobs: node.matched,
						aggregate: getAggregateState(node.matched),
						collapsed: collapsedIds.has(nodeId),
					},
				} satisfies Node<MatrixNodeData, "matrix">;
			} else {
				const job = node.matched[0];
				if (!job) continue;
				flowNode = {
					id: nodeId,
					type: "job",
					position: { x, y: currentY },
					data: {
						job,
						collapsed: collapsedIds.has(nodeId),
					},
				} satisfies Node<JobNodeData, "job">;
			}
			flowNodes.push(flowNode);
			currentY += estimateNodeHeight(flowNode) + ROW_GAP;
		}
	}

	const edges: GraphEdge[] = [];
	for (const node of defNodes) {
		for (const need of node.def.needs) {
			if (!keyToDefNode.has(need)) continue;
			const source = `def-${need}`;
			const target = `def-${node.key}`;
			edges.push({
				id: `${source}->${target}`,
				source,
				target,
				type: "smoothstep",
			});
		}
	}

	return { nodes: flowNodes, edges };
}
