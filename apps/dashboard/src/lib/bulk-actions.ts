export type BulkItemOutcome =
	| { status: "queued" }
	| { status: "running" }
	| { status: "done" }
	| { status: "failed"; error: string };

export type BulkActionResult = { ok: true } | { ok: false; error: string };

export type BulkPlan<T> = {
	targets: T[];
	skipped: { item: T; reason: string }[];
};

/** Splits a selection into the items an action applies to and the ones it leaves alone. */
export function planBulkAction<T>(
	items: readonly T[],
	skipReason: (item: T) => string | null,
): BulkPlan<T> {
	const plan: BulkPlan<T> = { targets: [], skipped: [] };
	for (const item of items) {
		const reason = skipReason(item);
		if (reason === null) plan.targets.push(item);
		else plan.skipped.push({ item, reason });
	}
	return plan;
}

/**
 * Runs one item at a time. Merges into the same base branch race each other
 * when sent together: GitHub rejects all but the first with "Base branch was
 * modified". A failure does not stop the items after it.
 */
export async function runBulkAction<T>({
	targets,
	run,
	onOutcome,
}: {
	targets: readonly T[];
	run: (item: T) => Promise<BulkActionResult>;
	onOutcome: (item: T, outcome: BulkItemOutcome) => void;
}): Promise<{ succeeded: T[]; failed: T[] }> {
	const succeeded: T[] = [];
	const failed: T[] = [];
	for (const item of targets) {
		onOutcome(item, { status: "running" });
		const result = await run(item).catch(
			(): BulkActionResult => ({ ok: false, error: "Something went wrong" }),
		);
		if (result.ok) {
			succeeded.push(item);
			onOutcome(item, { status: "done" });
		} else {
			failed.push(item);
			onOutcome(item, { status: "failed", error: result.error });
		}
	}
	return { succeeded, failed };
}

export type CountNoun = { one: string; other: string };

/** "1 pull request", "3 pull requests". */
export function countOf(count: number, noun: CountNoun) {
	return `${count} ${count === 1 ? noun.one : noun.other}`;
}

export type BulkRun<T> =
	| { status: "idle" }
	| { status: "confirming"; actionId: string }
	| {
			status: "running" | "settled";
			actionId: string;
			targets: readonly T[];
			outcomes: ReadonlyMap<T, BulkItemOutcome>;
	  }
	| { status: "succeeded"; actionId: string; count: number };

export type BulkRunEvent<T> =
	| { type: "opened"; actionId: string }
	| { type: "started"; targets: readonly T[] }
	| { type: "outcome"; item: T; outcome: BulkItemOutcome }
	| { type: "finished" }
	| { type: "dismissed" };

export const IDLE_BULK_RUN = { status: "idle" } as const;

/**
 * A run with failures ends `settled`, kept open so they can be read and
 * retried; a clean one ends `succeeded`, which only announces the result.
 * A run in flight cannot be dismissed.
 */
export function bulkRunReducer<T>(
	run: BulkRun<T>,
	event: BulkRunEvent<T>,
): BulkRun<T> {
	switch (event.type) {
		case "opened":
			return run.status === "idle" || run.status === "succeeded"
				? { status: "confirming", actionId: event.actionId }
				: run;
		case "started":
			if (run.status !== "confirming" && run.status !== "settled") return run;
			return {
				status: "running",
				actionId: run.actionId,
				targets: event.targets,
				outcomes: new Map(
					event.targets.map((item) => [item, { status: "queued" }]),
				),
			};
		case "outcome":
			if (run.status !== "running") return run;
			return {
				...run,
				outcomes: new Map(run.outcomes).set(event.item, event.outcome),
			};
		case "finished": {
			if (run.status !== "running") return run;
			const hasFailure = [...run.outcomes.values()].some(
				(outcome) => outcome.status === "failed",
			);
			return hasFailure
				? { ...run, status: "settled" }
				: {
						status: "succeeded",
						actionId: run.actionId,
						count: run.targets.length,
					};
		}
		case "dismissed":
			return run.status === "running" ? run : IDLE_BULK_RUN;
	}
}
