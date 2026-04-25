import type { QueryClient } from "@tanstack/react-query";
import { type GitHubQueryScope, githubQueryKeys } from "./github.query";
import type { MyPullsResult, PullSummary, RepoOverview } from "./github.types";

function matchesPull(
	pull: Pick<PullSummary, "number" | "repository">,
	owner: string,
	repo: string,
	pullNumber: number,
) {
	return (
		pull.number === pullNumber &&
		pull.repository.owner === owner &&
		pull.repository.name === repo
	);
}

export function removePullFromOpenViews(
	queryClient: QueryClient,
	scope: GitHubQueryScope,
	input: { owner: string; repo: string; pullNumber: number },
) {
	const { owner, repo, pullNumber } = input;

	queryClient.setQueryData<MyPullsResult>(
		githubQueryKeys.pulls.mine(scope),
		(current) => {
			if (!current) {
				return current;
			}

			return {
				...current,
				reviewRequested: current.reviewRequested.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
				assigned: current.assigned.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
				authored: current.authored.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
				mentioned: current.mentioned.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
				involved: current.involved.filter(
					(pull) => !matchesPull(pull, owner, repo, pullNumber),
				),
			};
		},
	);

	queryClient.setQueriesData<PullSummary[]>(
		{
			predicate: (query) => {
				const key = query.queryKey;
				if (!Array.isArray(key) || key.length < 5) {
					return false;
				}

				if (
					key[0] !== "github" ||
					key[1] !== scope.userId ||
					key[2] !== "pulls" ||
					key[3] !== "repo"
				) {
					return false;
				}

				const queryInput = key[4];
				if (!queryInput || typeof queryInput !== "object") {
					return false;
				}

				const repoInput = queryInput as {
					owner?: string;
					repo?: string;
					state?: string;
				};

				return (
					repoInput.owner === owner &&
					repoInput.repo === repo &&
					(repoInput.state === undefined || repoInput.state === "open")
				);
			},
		},
		(current) => {
			if (!current) {
				return current;
			}

			return current.filter(
				(pull) => !matchesPull(pull, owner, repo, pullNumber),
			);
		},
	);

	queryClient.setQueryData<RepoOverview>(
		githubQueryKeys.repo.overview(scope, { owner, repo }),
		(current) => {
			if (!current) {
				return current;
			}

			return {
				...current,
				openPullCount: Math.max(0, current.openPullCount - 1),
			};
		},
	);
}
