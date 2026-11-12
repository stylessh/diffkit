/** Repositories with a saved map. Knowing this must not cost loading one. */
export const MAPPED_REPOS = ["stylessh/diffkit"] as const;

export type MappedRepo = (typeof MAPPED_REPOS)[number];

export function mappedRepo(owner: string, repo: string): MappedRepo | null {
	const key = `${owner}/${repo}`.toLowerCase();
	return MAPPED_REPOS.find((candidate) => candidate === key) ?? null;
}
