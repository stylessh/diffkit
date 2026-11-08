import {
	type QueryClient,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type CodeLocation,
	resolveCodeLocation,
} from "#/lib/code-browsing/code-location";
import {
	type GitHubQueryScope,
	githubRepoBranchesQueryOptions,
	githubRepoOverviewQueryOptions,
	githubRepoRefNamesQueryOptions,
	githubRepoRefSplatQueryOptions,
} from "#/lib/github.query";
import type { RepoOverview } from "#/lib/github.types";

type RepoInput = { owner: string; repo: string };

export function cachedRefNames(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: RepoInput,
): string[] {
	const branches = queryClient.getQueryData(
		githubRepoBranchesQueryOptions(scope, input).queryKey,
	);
	const branchNames = queryClient.getQueryData(
		githubRepoRefNamesQueryOptions(scope, { ...input, kind: "branches" })
			.queryKey,
	);
	const tagNames = queryClient.getQueryData(
		githubRepoRefNamesQueryOptions(scope, { ...input, kind: "tags" }).queryKey,
	);
	return [
		...(branches ?? []).map((branch) => branch.name),
		...(branchNames?.names ?? []),
		...(tagNames?.names ?? []),
	];
}

export type CodeLocationState =
	| { status: "pending" }
	| { status: "ready"; repo: RepoOverview; location: CodeLocation };

export function useCodeLocation(
	scope: GitHubQueryScope,
	input: RepoInput & { splat: string | undefined },
): CodeLocationState {
	const queryClient = useQueryClient();
	const repoInput = { owner: input.owner, repo: input.repo };
	const overviewQuery = useQuery(
		githubRepoOverviewQueryOptions(scope, repoInput),
	);
	if (overviewQuery.error) throw overviewQuery.error;

	const local = overviewQuery.data
		? resolveCodeLocation(input.splat, {
				defaultBranch: overviewQuery.data.defaultBranch,
				known: cachedRefNames(queryClient, scope, repoInput),
			})
		: null;
	const serverQuery = useQuery({
		...githubRepoRefSplatQueryOptions(scope, {
			...repoInput,
			splat: input.splat ?? "",
		}),
		enabled: local?.status === "needsServer",
	});

	const repo = overviewQuery.data;
	if (!repo || !local) return { status: "pending" };
	if (local.status === "resolved") {
		return { status: "ready", repo, location: local.location };
	}
	const resolved = serverQuery.data;
	if (!resolved) return { status: "pending" };
	return {
		status: "ready",
		repo,
		location: { ref: resolved.ref ?? repo.defaultBranch, path: resolved.path },
	};
}
