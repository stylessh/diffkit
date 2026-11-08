import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import type { GitHubQueryScope } from "./github.query";

const protectedRoute = getRouteApi("/_protected");

export function useGitHubQueryScope(): GitHubQueryScope {
	const { user } = protectedRoute.useRouteContext();
	return useMemo(() => ({ userId: user.id }), [user.id]);
}
