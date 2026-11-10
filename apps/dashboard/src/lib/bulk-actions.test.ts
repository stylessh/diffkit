import { describe, expect, it } from "vitest";
import {
	type BulkItemOutcome,
	type BulkRun,
	type BulkRunEvent,
	bulkRunReducer,
	IDLE_BULK_RUN,
	runBulkAction,
} from "./bulk-actions";

function reduce(events: BulkRunEvent<string>[], from: BulkRun<string>) {
	return events.reduce(bulkRunReducer<string>, from);
}

describe("runBulkAction", () => {
	it("runs one item at a time and keeps going past a failure", async () => {
		let inFlight = 0;
		let mostInFlight = 0;
		const outcomes: [string, BulkItemOutcome["status"]][] = [];

		const result = await runBulkAction({
			targets: ["a", "b", "c", "d"],
			run: async (item) => {
				inFlight += 1;
				mostInFlight = Math.max(mostInFlight, inFlight);
				await Promise.resolve();
				inFlight -= 1;
				if (item === "b") return { ok: false, error: "Not mergeable" };
				if (item === "c") throw new Error("network");
				return { ok: true };
			},
			onOutcome: (item, outcome) => outcomes.push([item, outcome.status]),
		});

		expect(mostInFlight).toBe(1);
		expect(result).toEqual({ succeeded: ["a", "d"], failed: ["b", "c"] });
		expect(outcomes).toEqual([
			["a", "running"],
			["a", "done"],
			["b", "running"],
			["b", "failed"],
			["c", "running"],
			["c", "failed"],
			["d", "running"],
			["d", "done"],
		]);
	});
});

describe("bulkRunReducer", () => {
	const confirming = reduce(
		[{ type: "opened", actionId: "merge" }],
		IDLE_BULK_RUN,
	);

	it("announces a run with no failures, then makes way for the next action", () => {
		const run = reduce(
			[
				{ type: "started", targets: ["a", "b"] },
				{ type: "outcome", item: "a", outcome: { status: "done" } },
				{ type: "outcome", item: "b", outcome: { status: "done" } },
				{ type: "finished" },
			],
			confirming,
		);
		expect(run).toEqual({ status: "succeeded", actionId: "merge", count: 2 });
		expect(reduce([{ type: "dismissed" }], run)).toEqual(IDLE_BULK_RUN);
		expect(reduce([{ type: "opened", actionId: "close" }], run)).toEqual({
			status: "confirming",
			actionId: "close",
		});
	});

	it("stays open on a failure until it is retried or dismissed, and cannot be dismissed mid-run", () => {
		const running = reduce(
			[
				{ type: "started", targets: ["a", "b"] },
				{ type: "outcome", item: "a", outcome: { status: "done" } },
				{ type: "dismissed" },
			],
			confirming,
		);
		expect(running.status).toBe("running");

		const settled = reduce(
			[
				{
					type: "outcome",
					item: "b",
					outcome: { status: "failed", error: "Not mergeable" },
				},
				{ type: "finished" },
			],
			running,
		);
		expect(settled).toMatchObject({ status: "settled", actionId: "merge" });

		const retry = reduce([{ type: "started", targets: ["b"] }], settled);
		expect(retry).toMatchObject({ status: "running", targets: ["b"] });
		expect(reduce([{ type: "dismissed" }], settled)).toEqual(IDLE_BULK_RUN);
	});
});
