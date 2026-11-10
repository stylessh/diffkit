type CheckRunPayload = {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
};

export function deduplicateCheckRuns<T extends CheckRunPayload>(
	checkRuns: T[],
): T[] {
	const latestByName = new Map<string, T>();
	for (const check of checkRuns) {
		const existing = latestByName.get(check.name);
		if (!existing || check.id > existing.id) {
			latestByName.set(check.name, check);
		}
	}
	return Array.from(latestByName.values());
}

/** Must agree with the UI's `getCheckRunStatus`. */
export function isFailedCheckRun(run: CheckRunPayload): boolean {
	return (
		run.status === "completed" &&
		run.conclusion !== "success" &&
		run.conclusion !== "neutral" &&
		run.conclusion !== "skipped" &&
		run.conclusion !== "stale" &&
		run.conclusion !== null
	);
}
