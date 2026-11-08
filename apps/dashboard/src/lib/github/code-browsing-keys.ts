import type {
	RepoCodeInput,
	RepoCodePathInput,
	RepoCodeSearchInput,
} from "../code-browsing/types";
import type { GitHubQueryScope } from "./query-keys";

export const codeBrowsingQueryKeys = {
	gitTree: (scope: GitHubQueryScope, input: RepoCodeInput) =>
		["github", scope.userId, "code", "gitTree", input] as const,
	blob: (scope: GitHubQueryScope, input: RepoCodePathInput) =>
		["github", scope.userId, "code", "blob", input] as const,
	blame: (scope: GitHubQueryScope, input: RepoCodePathInput) =>
		["github", scope.userId, "code", "blame", input] as const,
	search: (scope: GitHubQueryScope, input: RepoCodeSearchInput) =>
		["github", scope.userId, "code", "search", input] as const,
};
