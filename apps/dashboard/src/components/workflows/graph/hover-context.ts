import { createContext, useContext } from "react";

const NodeHoverContext = createContext<string | null>(null);

export const NodeHoverProvider = NodeHoverContext.Provider;

export function useIsNodeHovered(nodeId: string): boolean {
	return useContext(NodeHoverContext) === nodeId;
}
