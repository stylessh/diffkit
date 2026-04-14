import type { TabType } from "./tab-store";

type LaunchTabTarget = {
	id: string;
	type: TabType;
	repo: string;
	number?: number;
};

export type LaunchTarget = {
	to: string;
	tab: LaunchTabTarget | null;
};

function isPositiveIntegerSegment(segment: string) {
	return /^[1-9]\d*$/u.test(segment);
}

function createTabTarget(
	type: TabType,
	owner: string,
	repoName: string,
	number?: number,
): LaunchTabTarget {
	const repo = `${owner}/${repoName}`;
	return {
		id: number != null ? `${type}:${repo}#${number}` : `${type}:${repo}`,
		type,
		repo,
		number,
	};
}

export function classifyLaunchPath(pathname: string): LaunchTabTarget | null {
	const path = pathname.trim();
	if (!path.startsWith("/")) return null;

	const segments = path.split("/").filter(Boolean);
	if (segments.length === 2) {
		const [owner, repoName] = segments;
		return createTabTarget("repo", owner, repoName);
	}

	if (segments.length !== 4) {
		return null;
	}

	const [owner, repoName, section, numberRaw] = segments;

	if (!["pull", "issues", "review"].includes(section)) return null;
	if (!isPositiveIntegerSegment(numberRaw)) return null;

	return createTabTarget(
		section as TabType,
		owner,
		repoName,
		Number(numberRaw),
	);
}

export function resolveLaunchTarget(
	rawTargetUrl: unknown,
): LaunchTarget | null {
	if (typeof rawTargetUrl !== "string") {
		return null;
	}

	let targetUrl: URL;
	try {
		targetUrl = new URL(rawTargetUrl);
	} catch {
		return null;
	}

	const to = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
	return {
		to,
		tab: classifyLaunchPath(targetUrl.pathname),
	};
}
