import type { PullSummary } from "../github.types";

export type PullListStatsNode = {
	number: number;
	additions: number;
	deletions: number;
	comments: { totalCount: number };
} | null;

export type PullListStatsResponse = {
	repository: Record<string, PullListStatsNode> | null;
};

/**
 * REST `pulls.list` carries no line counts or comment totals, so the repo
 * list fetches them for the whole page in one aliased GraphQL query.
 */
export function buildPullListStatsQuery(numbers: number[]) {
	const pullAliases = numbers.map(
		(number) =>
			`p${number}: pullRequest(number: ${number}) { number additions deletions comments { totalCount } }`,
	);
	return `query($owner: String!, $repo: String!) {
		repository(owner: $owner, name: $repo) {
			${pullAliases.join("\n")}
		}
	}`;
}

export function applyPullListStats(
	pulls: PullSummary[],
	response: PullListStatsResponse,
): PullSummary[] {
	const byNumber = new Map<number, NonNullable<PullListStatsNode>>();
	for (const node of Object.values(response.repository ?? {})) {
		if (node) byNumber.set(node.number, node);
	}
	return pulls.map((pull) => {
		const stats = byNumber.get(pull.number);
		if (!stats) return pull;
		return {
			...pull,
			additions: stats.additions,
			deletions: stats.deletions,
			comments: stats.comments.totalCount,
		};
	});
}
