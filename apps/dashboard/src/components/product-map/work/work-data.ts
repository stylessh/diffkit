import diffkitWork from "../data/diffkit-work.json?raw";

/** How much of one pull request lands on one product area, by lines changed. */
export type WorkPart = { area: string; lines: number; share: number };

export type PullWork = { fix: boolean; parts: WorkPart[] };

/** One pull request as seen from a single area. */
export type AreaTouch = {
	number: number;
	lines: number;
	share: number;
	fix: boolean;
};

export type ProductWork = {
	pulls: Map<number, PullWork>;
	/** Oldest first. */
	byArea: Map<string, AreaTouch[]>;
};

type WorkFile = { repo: string; pulls: Record<string, PullWork> };

const files: Record<string, string> = {
	"stylessh/diffkit": diffkitWork,
};

const loaded = new Map<string, ProductWork>();

export function loadProductWork(
	owner: string,
	repo: string,
): ProductWork | null {
	const key = `${owner}/${repo}`.toLowerCase();
	const cached = loaded.get(key);
	if (cached) return cached;
	const raw = files[key];
	if (!raw) return null;
	const file = JSON.parse(raw) as WorkFile;
	const pulls = new Map<number, PullWork>();
	const byArea = new Map<string, AreaTouch[]>();
	const numbers = Object.keys(file.pulls)
		.map(Number)
		.sort((a, b) => a - b);
	for (const number of numbers) {
		const pull = file.pulls[number];
		pulls.set(number, pull);
		for (const part of pull.parts) {
			const touches = byArea.get(part.area) ?? [];
			touches.push({
				number,
				lines: part.lines,
				share: part.share,
				fix: pull.fix,
			});
			byArea.set(part.area, touches);
		}
	}
	const result = { pulls, byArea };
	loaded.set(key, result);
	return result;
}

export function formatShare(share: number) {
	return share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`;
}
