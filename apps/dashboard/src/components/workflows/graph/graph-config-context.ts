import { createContext, useContext } from "react";
import type { GitHubQueryScope } from "#/lib/github.query";

export type GraphConfig = {
	scope: GitHubQueryScope;
	owner: string;
	repo: string;
	runId: number;
};

const GraphConfigContext = createContext<GraphConfig | null>(null);

export const GraphConfigProvider = GraphConfigContext.Provider;

export function useGraphConfig(): GraphConfig {
	const ctx = useContext(GraphConfigContext);
	if (!ctx)
		throw new Error("useGraphConfig must be used inside GraphConfigProvider");
	return ctx;
}
