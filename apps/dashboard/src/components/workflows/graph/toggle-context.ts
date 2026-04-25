import { createContext, useContext } from "react";

const NodeToggleContext = createContext<(id: string) => void>(() => {});

export const NodeToggleProvider = NodeToggleContext.Provider;

export function useNodeToggle(): (id: string) => void {
	return useContext(NodeToggleContext);
}
