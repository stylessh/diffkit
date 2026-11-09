import { useMatch } from "@tanstack/react-router";
import { useMemo } from "react";
import { useIsSkeletonSample } from "#/components/shared/skeleton-sample";
import type { GitHubQueryScope } from "./github.query";

const SAMPLE_USER_ID = "sample";

/**
 * The signed-in viewer's query scope. Sample renders can sit outside the
 * signed-in routes (the landing preview does), where there is no viewer.
 */
export function useGitHubQueryScope(): GitHubQueryScope {
	const isSample = useIsSkeletonSample();
	const match = useMatch({ from: "/_protected", shouldThrow: !isSample });
	const userId = match ? match.context.user.id : SAMPLE_USER_ID;
	return useMemo(() => ({ userId }), [userId]);
}
