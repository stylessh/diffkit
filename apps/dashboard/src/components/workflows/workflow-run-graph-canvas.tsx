import { Background, type Node, ReactFlow, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@diffkit/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";
import type {
	WorkflowDefinition,
	WorkflowRun,
	WorkflowRunJob,
} from "#/lib/github.types";
import { buildLayoutFromDefinition } from "./graph/build-layout";
import {
	COLUMN_GAP,
	MATRIX_SUFFIX_RE,
	NODE_WIDTH,
	ROW_GAP,
	STEP_LOG_GAP,
	STEP_LOG_HEIGHT,
	VARIANT_POPUP_GAP,
} from "./graph/constants";
import { collectConnectedEdgeIds } from "./graph/edges";
import {
	type GraphConfig,
	GraphConfigProvider,
} from "./graph/graph-config-context";
import { GraphControls } from "./graph/graph-controls";
import {
	buildColumns,
	getAggregateState,
	getGroupId,
	groupJobs,
} from "./graph/grouping";
import { estimateNodeHeight } from "./graph/height";
import { NodeHoverProvider } from "./graph/hover-context";
import { JobNode } from "./graph/job-node";
import { MatrixNode } from "./graph/matrix-node";
import {
	getStepLogNodeId,
	type OpenStepLogInput,
	type StepLogActions,
	StepLogProvider,
} from "./graph/step-log-context";
import { StepLogNode } from "./graph/step-log-node";
import { NodeToggleProvider } from "./graph/toggle-context";
import type {
	FlowNode,
	GraphEdge,
	JobNodeData,
	MatrixNodeData,
	StepLogNodeData,
} from "./graph/types";

const nodeTypes = {
	job: JobNode,
	matrix: MatrixNode,
	stepLog: StepLogNode,
};

const FIT_VIEW_OPTIONS = { padding: 0.25, maxZoom: 1 };
const PRO_OPTIONS = { hideAttribution: true };
const DEFAULT_EDGE_OPTIONS = { type: "smoothstep" as const };

function getPopupNodeId(matrixId: string, jobId: number): string {
	return `variant-${matrixId}-${jobId}`;
}

export function WorkflowRunGraphCanvas({
	run,
	jobs,
	definition,
	scope,
	owner,
	repo,
	runId,
}: {
	run: WorkflowRun;
	jobs: WorkflowRunJob[];
	definition: WorkflowDefinition | null;
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	runId: number;
}) {
	const workflowFilename = useMemo(() => {
		const segments = run.path.split("/");
		return segments[segments.length - 1] || run.path;
	}, [run.path]);

	const graphConfig = useMemo<GraphConfig>(
		() => ({ scope, owner, repo, runId }),
		[scope, owner, repo, runId],
	);

	const collectDefaultCollapsedIds = useCallback(
		(jobs: WorkflowRunJob[], definition: WorkflowDefinition | null) => {
			const ids = new Set<string>();
			for (const job of jobs) {
				const match = MATRIX_SUFFIX_RE.exec(job.name);
				if (match) {
					ids.add(`matrix-${match[1]}`);
					ids.add(`def-${match[1]}`);
					ids.add(getPopupNodeId(`matrix-${match[1]}`, job.id));
					ids.add(getPopupNodeId(`def-${match[1]}`, job.id));
				} else {
					ids.add(`job-${job.id}`);
				}
			}
			if (definition) {
				for (const yamlJob of definition.jobs) {
					ids.add(`def-${yamlJob.key}`);
				}
			}
			return ids;
		},
		[],
	);

	const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
		collectDefaultCollapsedIds(jobs, definition),
	);

	const autoCollapsedRef = useRef<Set<string>>(new Set(collapsedIds));
	useEffect(() => {
		const desired = collectDefaultCollapsedIds(jobs, definition);
		const toAdd: string[] = [];
		for (const id of desired) {
			if (!autoCollapsedRef.current.has(id)) {
				toAdd.push(id);
				autoCollapsedRef.current.add(id);
			}
		}
		if (toAdd.length === 0) return;
		setCollapsedIds((prev) => {
			const next = new Set(prev);
			for (const id of toAdd) next.add(id);
			return next;
		});
	}, [jobs, definition, collectDefaultCollapsedIds]);

	const toggleCollapsed = useCallback((nodeId: string) => {
		setCollapsedIds((prev) => {
			const next = new Set(prev);
			if (next.has(nodeId)) next.delete(nodeId);
			else next.add(nodeId);
			return next;
		});
	}, []);

	const [openStepLogs, setOpenStepLogs] = useState<OpenStepLogInput[]>([]);
	const stepLogActions = useMemo<StepLogActions>(
		() => ({
			open: (input) => {
				setOpenStepLogs((prev) => {
					if (
						prev.some(
							(l) =>
								l.jobId === input.jobId && l.stepNumber === input.stepNumber,
						)
					) {
						return prev;
					}
					return [...prev, input];
				});
			},
			close: (nodeId) => {
				setOpenStepLogs((prev) =>
					prev.filter(
						(l) => getStepLogNodeId(l.jobId, l.stepNumber) !== nodeId,
					),
				);
			},
		}),
		[],
	);

	useEffect(() => {
		setOpenStepLogs((prev) => {
			const jobById = new Map(jobs.map((j) => [j.id, j]));
			const next = prev.filter((l) => {
				const job = jobById.get(l.jobId);
				if (!job) return false;
				return job.steps.some((s) => s.number === l.stepNumber);
			});
			return next.length === prev.length ? prev : next;
		});
	}, [jobs]);

	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [stepLogPositions, setStepLogPositions] = useState<
		Record<string, { x: number; y: number }>
	>({});

	useEffect(() => {
		setStepLogPositions((prev) => {
			const active = new Set(
				openStepLogs.map((l) => getStepLogNodeId(l.jobId, l.stepNumber)),
			);
			let changed = false;
			const next: typeof prev = {};
			for (const [key, value] of Object.entries(prev)) {
				if (active.has(key)) next[key] = value;
				else changed = true;
			}
			return changed ? next : prev;
		});
	}, [openStepLogs]);

	const { nodes: computedNodes, baseEdges } = useMemo(() => {
		let builtNodes: FlowNode[] = [];
		let builtEdges: GraphEdge[] = [];

		if (definition) {
			const layout = buildLayoutFromDefinition(jobs, definition, collapsedIds);
			if (layout) {
				builtNodes = layout.nodes;
				builtEdges = layout.edges;
			}
		}

		if (builtNodes.length === 0) {
			const groups = groupJobs(jobs);
			const columns = buildColumns(groups);

			columns.forEach((column, colIndex) => {
				const x = colIndex * (NODE_WIDTH + COLUMN_GAP);
				let currentY = 0;
				for (const group of column) {
					const nodeId = getGroupId(group);
					let flowNode: FlowNode;
					if (group.kind === "matrix") {
						flowNode = {
							id: nodeId,
							type: "matrix",
							position: { x, y: currentY },
							data: {
								baseName: group.baseName,
								jobs: group.jobs,
								aggregate: getAggregateState(group.jobs),
								collapsed: collapsedIds.has(nodeId),
							},
						} satisfies Node<MatrixNodeData, "matrix">;
					} else {
						flowNode = {
							id: nodeId,
							type: "job",
							position: { x, y: currentY },
							data: {
								job: group.job,
								collapsed: collapsedIds.has(nodeId),
							},
						} satisfies Node<JobNodeData, "job">;
					}
					builtNodes.push(flowNode);
					currentY += estimateNodeHeight(flowNode) + ROW_GAP;
				}
			});
		}

		const matrixNodes = builtNodes.filter(
			(n): n is Node<MatrixNodeData, "matrix"> => n.type === "matrix",
		);
		for (const matrix of matrixNodes) {
			const popupX =
				matrix.position.x + NODE_WIDTH + COLUMN_GAP + VARIANT_POPUP_GAP;
			let popupY = matrix.position.y;
			for (const job of matrix.data.jobs) {
				const popupId = getPopupNodeId(matrix.id, job.id);
				const popupNode = {
					id: popupId,
					type: "job",
					position: { x: popupX, y: popupY },
					data: {
						job,
						collapsed: collapsedIds.has(popupId),
					},
				} satisfies Node<JobNodeData, "job">;
				builtNodes.push(popupNode);
				builtEdges.push({
					id: `${matrix.id}->${popupId}`,
					source: matrix.id,
					target: popupId,
					type: "smoothstep",
				});
				popupY += estimateNodeHeight(popupNode) + ROW_GAP;
			}
		}

		if (openStepLogs.length > 0) {
			let maxRight = 0;
			for (const n of builtNodes) {
				maxRight = Math.max(maxRight, n.position.x + NODE_WIDTH);
			}
			const stepLogX = maxRight + COLUMN_GAP + STEP_LOG_GAP;
			const logsByNodeId = new Map<string, OpenStepLogInput[]>();
			for (const log of openStepLogs) {
				const arr = logsByNodeId.get(log.sourceNodeId) ?? [];
				arr.push(log);
				logsByNodeId.set(log.sourceNodeId, arr);
			}
			let currentY = 0;
			for (const [sourceNodeId, logs] of logsByNodeId) {
				for (const log of logs) {
					const nodeId = getStepLogNodeId(log.jobId, log.stepNumber);
					const job = jobs.find((j) => j.id === log.jobId);
					const step = job?.steps.find((s) => s.number === log.stepNumber);
					if (!job || !step) continue;
					const persisted = stepLogPositions[nodeId];
					const stepLogNode = {
						id: nodeId,
						type: "stepLog",
						position: persisted ?? { x: stepLogX, y: currentY },
						draggable: true,
						data: {
							jobId: job.id,
							jobStatus: job.status,
							stepNumber: step.number,
							stepName: step.name,
							stepStatus: step.status,
							stepConclusion: step.conclusion,
							stepStartedAt: step.startedAt,
							stepCompletedAt: step.completedAt,
						},
					} satisfies Node<StepLogNodeData, "stepLog">;
					builtNodes.push(stepLogNode);
					builtEdges.push({
						id: `${sourceNodeId}->${nodeId}`,
						source: sourceNodeId,
						target: nodeId,
						type: "smoothstep",
					});
					currentY += STEP_LOG_HEIGHT + ROW_GAP;
				}
			}
		}

		return { nodes: builtNodes, baseEdges: builtEdges };
	}, [jobs, definition, collapsedIds, openStepLogs, stepLogPositions]);

	const [internalNodes, setInternalNodes, onNodesChange] =
		useNodesState<FlowNode>([]);

	useEffect(() => {
		setInternalNodes((prev) => {
			const prevById = new Map(prev.map((n) => [n.id, n]));
			return computedNodes.map((node) => {
				if (node.type !== "stepLog") return node;
				const prevNode = prevById.get(node.id);
				if (prevNode && prevNode.type === "stepLog") {
					return { ...node, position: prevNode.position };
				}
				return node;
			});
		});
	}, [computedNodes, setInternalNodes]);

	const edges = useMemo(() => {
		if (!hoveredNodeId) {
			return baseEdges.map((edge) => ({
				...edge,
				style: { stroke: "var(--color-border)", strokeWidth: 1.5 },
			}));
		}
		const connected = collectConnectedEdgeIds(hoveredNodeId, baseEdges);
		return baseEdges.map((edge) => {
			const isConnected = connected.has(edge.id);
			return {
				...edge,
				animated: isConnected,
				zIndex: isConnected ? 1000 : 0,
				style: {
					stroke: isConnected
						? "var(--color-foreground)"
						: "var(--color-border)",
					strokeWidth: isConnected ? 2 : 1.5,
					opacity: isConnected ? 1 : 0.35,
				},
			};
		});
	}, [baseEdges, hoveredNodeId]);

	const containerRef = useRef<HTMLDivElement>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	useEffect(() => {
		const handler = () =>
			setIsFullscreen(document.fullscreenElement === containerRef.current);
		document.addEventListener("fullscreenchange", handler);
		return () => document.removeEventListener("fullscreenchange", handler);
	}, []);
	const toggleFullscreen = useCallback(() => {
		const el = containerRef.current;
		if (!el) return;
		if (document.fullscreenElement) {
			void document.exitFullscreen();
		} else {
			void el.requestFullscreen();
		}
	}, []);

	const onNodeMouseEnter = useCallback(
		(_e: React.MouseEvent, node: Node) => setHoveredNodeId(node.id),
		[],
	);
	const onNodeMouseLeave = useCallback(() => setHoveredNodeId(null), []);

	const onNodeDragStop = useCallback((_e: React.MouseEvent, node: Node) => {
		if (node.type !== "stepLog") return;
		setStepLogPositions((prev) => ({
			...prev,
			[node.id]: { x: node.position.x, y: node.position.y },
		}));
	}, []);

	return (
		<div
			ref={containerRef}
			className={cn(
				"relative flex flex-col overflow-hidden rounded-xl border bg-surface-1",
				isFullscreen && "h-screen w-screen rounded-none",
			)}
		>
			<div
				className={cn(
					"w-full",
					isFullscreen ? "flex-1" : "h-[620px] rounded-b-xl",
				)}
			>
				{internalNodes.length === 0 ? (
					<p className="p-6 text-muted-foreground text-sm">No jobs yet.</p>
				) : (
					<GraphConfigProvider value={graphConfig}>
						<StepLogProvider value={stepLogActions}>
							<NodeToggleProvider value={toggleCollapsed}>
								<NodeHoverProvider value={hoveredNodeId}>
									<ReactFlow
										nodes={internalNodes}
										edges={edges}
										onNodesChange={onNodesChange}
										nodeTypes={nodeTypes}
										fitView
										fitViewOptions={FIT_VIEW_OPTIONS}
										proOptions={PRO_OPTIONS}
										nodesConnectable={false}
										nodesDraggable={false}
										edgesFocusable={false}
										defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
										onNodeMouseEnter={onNodeMouseEnter}
										onNodeMouseLeave={onNodeMouseLeave}
										onNodeDragStop={onNodeDragStop}
										className="!bg-surface-1 [&_.react-flow__node]:!cursor-default"
									>
										<Background color="var(--color-border)" gap={20} size={1} />
										<GraphControls
											isFullscreen={isFullscreen}
											onToggleFullscreen={toggleFullscreen}
										/>
									</ReactFlow>
								</NodeHoverProvider>
							</NodeToggleProvider>
						</StepLogProvider>
					</GraphConfigProvider>
				)}
			</div>

			<div className="pointer-events-none absolute top-3 left-3 z-10 flex w-fit flex-col gap-0.5 rounded-lg bg-surface-1 px-4 py-3">
				<h2 className="font-medium text-sm">{workflowFilename}</h2>
				<p className="text-muted-foreground text-xs">on: {run.event}</p>
			</div>
		</div>
	);
}
