import type { PullSummary } from "#/lib/github.types";

export type PreviewPage = "overview" | "inbox" | "pulls" | "reviews" | "issues";

export type PreviewView =
	| { kind: "page"; page: PreviewPage }
	| { kind: "pull"; pull: PullSummary };

const PAGE_BY_PATH: Record<string, PreviewPage> = {
	"/": "overview",
	"/inbox": "inbox",
	"/pulls": "pulls",
	"/reviews": "reviews",
	"/issues": "issues",
};

/** Where an app link leads inside the preview; `null` for anything it has no sample of. */
export function viewForHref(
	href: string,
	pulls: PullSummary[],
): PreviewView | null {
	const { pathname } = new URL(href, "https://preview.invalid");
	const page = PAGE_BY_PATH[pathname];
	if (page) return { kind: "page", page };
	const pull = pulls.find(
		(candidate) =>
			pathname === `/${candidate.repository.fullName}/pull/${candidate.number}`,
	);
	return pull ? { kind: "pull", pull } : null;
}
