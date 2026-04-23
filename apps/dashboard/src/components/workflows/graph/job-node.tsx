import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useCallback } from "react";
import { NODE_HANDLE_CLASS } from "./constants";
import { JobCard } from "./job-card";
import { useNodeToggle } from "./toggle-context";
import type { JobNodeData } from "./types";

export function JobNode({ id, data }: NodeProps<Node<JobNodeData, "job">>) {
	const toggle = useNodeToggle();
	const onToggle = useCallback(() => toggle(id), [id, toggle]);
	const canToggle = data.toggleable !== false;
	const expanded = !data.collapsed;
	return (
		<>
			<Handle
				type="target"
				position={Position.Left}
				className={NODE_HANDLE_CLASS}
			/>
			<JobCard
				job={data.job}
				nodeId={id}
				expanded={expanded}
				onToggle={canToggle ? onToggle : undefined}
			/>
			<Handle
				type="source"
				position={Position.Right}
				className={NODE_HANDLE_CLASS}
			/>
		</>
	);
}
