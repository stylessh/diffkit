import { afterEach, describe, expect, it, vi } from "vitest";
import { recordGitHubChanges } from "./github-change.server";
import { runScheduledMaintenance } from "./scheduled-maintenance.server";
import { createTestD1 } from "./testing/d1-sqlite";

const NOW = 1_800_000_000_000;

afterEach(() => {
	vi.restoreAllMocks();
});

function quiet() {
	return vi.spyOn(console, "log").mockImplementation(() => undefined);
}

describe("runScheduledMaintenance", () => {
	it("sweeps expired rows, keeps fresh ones and logs one JSON line", async () => {
		const log = quiet();
		const { db } = createTestD1(["0006_github_change.sql"]);
		await recordGitHubChanges(db, [
			{
				repo: "a/b",
				entityKey: "repo:a/b",
				isPrivate: true,
				changedAt: NOW - 16 * 60_000,
			},
			{
				repo: "a/b",
				entityKey: "repo:a/b",
				isPrivate: true,
				changedAt: NOW - 20 * 60_000,
			},
			{
				repo: "a/b",
				entityKey: "pull:a/b#1",
				isPrivate: true,
				changedAt: NOW - 60_000,
			},
		]);

		const summary = await runScheduledMaintenance(db, NOW);

		expect(summary).toMatchObject({
			task: "scheduled-maintenance",
			scheduledTime: NOW,
			sweep: { deleted: 2, batches: 1, complete: true },
			changeRows: 1,
		});
		expect(typeof summary.d1SizeBytes).toBe("number");
		expect(log).toHaveBeenCalledTimes(1);
		expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual(summary);
	});

	it("records a sweep failure but still checks health", async () => {
		quiet();
		const { db } = createTestD1(["0006_github_change.sql"]);
		const realPrepare = db.prepare.bind(db);
		db.prepare = ((sql: string) => {
			if (sql.startsWith("DELETE"))
				throw new Error("D1_ERROR: too many requests");
			return realPrepare(sql);
		}) as D1Database["prepare"];

		const summary = await runScheduledMaintenance(db, NOW);

		expect(summary.sweepError).toContain("too many requests");
		expect(summary.sweep).toBeUndefined();
		expect(summary.changeRows).toBe(0);
	});

	it("records a health failure but still sweeps", async () => {
		quiet();
		const { db } = createTestD1(["0006_github_change.sql"]);
		const realPrepare = db.prepare.bind(db);
		db.prepare = ((sql: string) => {
			if (sql.includes("COUNT(*)")) throw new Error("D1_ERROR: unavailable");
			return realPrepare(sql);
		}) as D1Database["prepare"];

		const summary = await runScheduledMaintenance(db, NOW);

		expect(summary.healthError).toContain("unavailable");
		expect(summary.sweep).toMatchObject({ complete: true });
	});

	it("never rejects, even when the whole database is unreachable", async () => {
		quiet();
		const db = {
			prepare: () => {
				throw new Error("D1 binding missing");
			},
		} as unknown as D1Database;
		const summary = await runScheduledMaintenance(db, NOW);
		expect(summary.sweepError).toBeDefined();
		expect(summary.healthError).toBeDefined();
	});
});
